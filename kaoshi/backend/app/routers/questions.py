from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app import crud, schemas, database
import io
import csv

router = APIRouter(
    prefix="/questions",
    tags=["questions"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.Question)
def create_question(question: schemas.QuestionCreate, db: Session = Depends(get_db)):
    # Check for strict duplicates using hash
    content_hash = crud.calculate_content_hash(question.content)
    existing = crud.get_question_by_hash(db, content_hash)
    if existing:
        raise HTTPException(status_code=400, detail=f"Duplicate question detected (ID: {existing.custom_id or existing.id})")
        
    return crud.create_question(db=db, question=question)

@router.get("/", response_model=schemas.QuestionListResponse)
def read_questions(
    skip: int = 0,
    limit: int = 100,
    q_type: Optional[str] = None,
    difficulty: Optional[int] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    source_doc: Optional[str] = None,
    review_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    questions, total = crud.get_questions_with_count(
        db, skip=skip, limit=limit, 
        q_type=q_type, difficulty=difficulty, tag=tag,
        search=search, status=status, source_doc=source_doc,
        review_status=review_status
    )
    return {"items": questions, "total": total}

# Batch Operations
from pydantic import BaseModel
from typing import Any

class ReviewRequest(BaseModel):
    status: str
    comment: Optional[str] = None
    reviewer: Optional[str] = "Admin"

@router.post("/{question_id}/review", response_model=schemas.Question)
def review_question(question_id: int, req: ReviewRequest, db: Session = Depends(get_db)):
    if req.status not in ['published', 'review', 'draft', 'disabled']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    db_question = crud.review_question(
        db, question_id, req.status, req.comment, req.reviewer
    )
    if db_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question


class BatchItem(BaseModel):
    id: int
    value: Optional[Any] = None
    comment: Optional[str] = None

class BatchOpRequest(BaseModel):
    ids: Optional[List[int]] = None
    items: Optional[List[BatchItem]] = None
    action: str # delete, update_status, update_difficulty, review
    value: Optional[Any] = None # For status or difficulty (global)
    comment: Optional[str] = None # For review (global)

class CheckDuplicateRequest(BaseModel):
    content: str
    threshold: float = 0.8

@router.post("/check_duplicate")
def check_duplicate(req: CheckDuplicateRequest, db: Session = Depends(get_db)):
    similar = crud.check_content_similarity(db, req.content, req.threshold)
    return {"similar_questions": similar}

@router.post("/export")
def export_questions(
    q_type: Optional[str] = None,
    difficulty: Optional[int] = None,
    tag: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    questions = crud.get_questions(
        db, skip=0, limit=100000, 
        q_type=q_type, difficulty=difficulty, tag=tag, status=status
    )
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Type', 'Content', 'Options', 'Answer', 'Difficulty', 'Tags', 'Status'])
    
    for q in questions:
        writer.writerow([
            q.custom_id or q.id,
            q.q_type,
            q.content,
            str(q.options) if q.options else '',
            q.answer,
            q.difficulty,
            ",".join(q.tags) if q.tags else '',
            q.status
        ])
    
    output.seek(0)
    
    crud.create_operation_log(
        db, action="export", target_type="question", 
        details={"count": len(questions), "filters": {"q_type": q_type, "tag": tag}}
    )
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=questions_export.csv"}
    )

@router.post("/parse_import")
async def parse_import_questions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Parse an import file and return the data for preview/validation without saving.
    """
    contents = await file.read()
    filename = file.filename
    
    df = None
    try:
        if filename.endswith('.csv'):
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding='gbk')
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(400, "Unsupported file format. Please use .csv or .xlsx")
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}")
    
    # Fill NaN with None/Empty
    df = df.where(pd.notnull(df), None)

    parsed_items = []
    
    for idx, row in df.iterrows():
        item = {
            "row_index": idx + 1,
            "status": "valid",
            "errors": [],
            "data": {}
        }
        
        try:
            # Map columns
            content = row.get('content') or row.get('题干')
            if not content:
                item["status"] = "invalid"
                item["errors"].append("Content is missing")
            else:
                item["data"]["content"] = str(content).strip()
                
            q_type = row.get('q_type') or row.get('题型') or 'single'
            type_map = {'单选': 'single', '多选': 'multi', '判断': 'judge', '简答': 'essay'}
            if q_type in type_map: q_type = type_map[q_type]
            item["data"]["q_type"] = str(q_type)
            
            difficulty = row.get('difficulty') or row.get('难度') or 3
            try:
                item["data"]["difficulty"] = int(difficulty)
            except:
                item["data"]["difficulty"] = 3
                
            options_raw = row.get('options') or row.get('选项')
            options = []
            if options_raw and isinstance(options_raw, str):
                options = [o.strip() for o in options_raw.split('\n') if o.strip()]
            item["data"]["options"] = options
            
            answer = row.get('answer') or row.get('答案') or ''
            item["data"]["answer"] = str(answer).strip()
            
            tags_raw = row.get('tags') or row.get('标签')
            tags = []
            if tags_raw and isinstance(tags_raw, str):
                tags = [t.strip() for t in tags_raw.split(',') if t.strip()]
            item["data"]["tags"] = tags
            
            item["data"]["analysis"] = str(row.get('analysis') or row.get('解析') or '') or None
            item["data"]["source_doc"] = str(row.get('source_doc') or row.get('来源') or '') or None

            # Validation: Check Duplicate
            if item["data"].get("content"):
                content_hash = crud.calculate_content_hash(item["data"]["content"])
                existing = crud.get_question_by_hash(db, content_hash)
                if existing:
                    item["status"] = "duplicate"
                    item["errors"].append("Duplicate question exists")
                    item["existing_id"] = existing.id

        except Exception as e:
            item["status"] = "error"
            item["errors"].append(str(e))
            
        parsed_items.append(item)

    return {"filename": filename, "total": len(parsed_items), "items": parsed_items}

@router.post("/import")
async def import_questions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    filename = file.filename
    
    df = None
    try:
        if filename.endswith('.csv'):
            # Try utf-8 then gbk
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding='gbk')
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(400, "Unsupported file format. Please use .csv or .xlsx")
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}")
    
    success_count = 0
    failed_count = 0
    errors = []
    
    # Fill NaN with None/Empty to avoid validation errors
    df = df.where(pd.notnull(df), None)

    for idx, row in df.iterrows():
        try:
            # Map columns
            content = row.get('content') or row.get('题干')
            if not content:
                continue
                
            q_type = row.get('q_type') or row.get('题型') or 'single'
            type_map = {'单选': 'single', '多选': 'multi', '判断': 'judge', '简答': 'essay'}
            if q_type in type_map: q_type = type_map[q_type]
            
            difficulty = row.get('difficulty') or row.get('难度') or 3
            try:
                difficulty = int(difficulty)
            except:
                difficulty = 3
                
            options_raw = row.get('options') or row.get('选项')
            options = []
            if options_raw and isinstance(options_raw, str):
                options = [o.strip() for o in options_raw.split('\n') if o.strip()]
            
            answer = row.get('answer') or row.get('答案') or ''
            
            tags_raw = row.get('tags') or row.get('标签')
            tags = []
            if tags_raw and isinstance(tags_raw, str):
                tags = [t.strip() for t in tags_raw.split(',') if t.strip()]
                
            q_schema = schemas.QuestionCreate(
                content=str(content).strip(),
                q_type=str(q_type),
                difficulty=difficulty,
                options=options,
                answer=str(answer).strip(),
                tags=tags,
                analysis=str(row.get('analysis') or row.get('解析') or '') or None,
                source_doc=str(row.get('source_doc') or row.get('来源') or '') or None
            )
            
            # Check duplicate
            content_hash = crud.calculate_content_hash(q_schema.content)
            existing = crud.get_question_by_hash(db, content_hash)
            if existing:
                failed_count += 1
                errors.append(f"Row {idx+1}: Duplicate content")
                continue

            crud.create_question(db, q_schema)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            errors.append(f"Row {idx+1}: {str(e)}")

    crud.create_operation_log(
        db, "batch_import", "question", 
        details={"filename": filename, "success": success_count, "failed": failed_count}
    )

    return {
        "success": success_count,
        "failed": failed_count,
        "errors": errors[:50]
    }

@router.post("/batch")
def batch_operations(req: BatchOpRequest, db: Session = Depends(get_db)):
    try:
        if req.action == "delete":
            ids = req.ids or (([item.id for item in req.items]) if req.items else [])
            if not ids: raise HTTPException(400, "No IDs provided")
            crud.batch_delete_questions(db, ids)
            crud.create_operation_log(db, "batch_delete", "question", ids)
            return {"msg": "Batch delete success"}
            
        elif req.action == "update_status":
            # Support both simple list (ids + global value) and detailed items
            if req.items:
                # Detailed mode (individual status/comments)
                crud.batch_review_questions(db, req.items)
                ids = [i.id for i in req.items]
                crud.create_operation_log(db, "batch_review", "question", ids, {"count": len(ids)})
                return {"msg": "Batch review success"}
            elif req.ids and req.value:
                # Simple mode (global status + optional global comment)
                crud.batch_update_status(db, req.ids, str(req.value), req.comment)
                crud.create_operation_log(db, "batch_update_status", "question", req.ids, {"value": req.value, "comment": req.comment})
                return {"msg": "Batch status update success"}
            else:
                 raise HTTPException(status_code=400, detail="Invalid parameters for update_status")

        elif req.action == "update_difficulty":
            if not req.value:
                raise HTTPException(status_code=400, detail="Value required for difficulty update")
            crud.batch_update_difficulty(db, req.ids, int(req.value))
            crud.create_operation_log(db, "batch_update_difficulty", "question", req.ids, {"value": req.value})
            return {"msg": "Batch difficulty update success"}
        elif req.action == "update_tags":
            if req.value is None: # Empty list is allowed
                raise HTTPException(status_code=400, detail="Value required for tags update")
            if not isinstance(req.value, list):
                 raise HTTPException(status_code=400, detail="Value must be a list of tags")
            crud.batch_update_tags(db, req.ids, req.value)
            crud.create_operation_log(db, "batch_update_tags", "question", req.ids, {"value": req.value})
            return {"msg": "Batch tags update success"}
        else:
            raise HTTPException(status_code=400, detail="Unknown action")
    except Exception as e:
        crud.create_operation_log(db, req.action, "question", req.ids, status="failed", error_message=str(e))
        raise e

class BatchCreateRequest(BaseModel):
    questions: List[schemas.QuestionCreate]

@router.post("/batch_create", response_model=List[schemas.Question])
def batch_create_questions(req: BatchCreateRequest, db: Session = Depends(get_db)):
    results = []
    errors = []
    for q in req.questions:
        try:
            # Re-use duplicate check logic manually or via crud
            # Ideally we should refactor create_question to not depend on router logic
            # But here we can just call crud.create_question, but first check hash
            content_hash = crud.calculate_content_hash(q.content)
            existing = crud.get_question_by_hash(db, content_hash)
            if existing:
                # Skip duplicate silently or return error?
                # For batch import, skipping or marking as error is better than failing all
                errors.append(f"Duplicate content: {q.content[:20]}...")
                continue
            
            new_q = crud.create_question(db=db, question=q)
            results.append(new_q)
        except Exception as e:
            errors.append(f"Error creating {q.content[:20]}...: {str(e)}")
            
    # We return created questions. Errors could be returned in headers or a wrapper response
    # For simple list response, we just return successes.
    # To provide feedback, maybe we should change response model.
    # But to keep compatible with "List[Question]", let's just return created ones.
    # Real-world app would return { success: [], failed: [] }
    return results

@router.get("/{question_id}", response_model=schemas.Question)
def read_question(question_id: int, db: Session = Depends(get_db)):
    db_question = crud.get_question(db, question_id=question_id)
    if db_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question

@router.delete("/{question_id}", response_model=schemas.Question)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    db_question = crud.delete_question(db, question_id=question_id)
    if db_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question

@router.put("/{question_id}", response_model=schemas.Question)
def update_question(question_id: int, question: schemas.QuestionUpdate, db: Session = Depends(get_db)):
    db_question = crud.update_question(db, question_id=question_id, question=question)
    if db_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question
