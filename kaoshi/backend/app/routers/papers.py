from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, database
from app.services.engine import AssemblyEngine
from app.services import exporter

router = APIRouter(
    prefix="/papers",
    tags=["papers"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/generate", response_model=schemas.ExamPaper)
def generate_paper(req: schemas.GeneratePaperRequest, db: Session = Depends(get_db)):
    engine = AssemblyEngine(db)
    selected_questions = engine.generate_paper(req.rule_config)
    if not selected_questions:
        raise HTTPException(status_code=400, detail="Could not generate paper. Please ensure there are enough 'Published' questions matching the rules.")
    paper_req = schemas.ExamPaperCreate(title=req.title, rule_id=req.rule_id)
    return crud.create_paper(db=db, paper=paper_req, questions=selected_questions)

@router.get("/", response_model=List[schemas.ExamPaper])
def list_papers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_papers(db=db, skip=skip, limit=limit)

@router.get("/{paper_id}", response_model=schemas.ExamPaper)
def read_paper(paper_id: int, db: Session = Depends(get_db)):
    db_paper = crud.get_paper(db, paper_id=paper_id)
    if db_paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")
    return db_paper

@router.get("/{paper_id}/export")
def export_paper(
    paper_id: int,
    format: str = "docx",
    include_answers: bool = True,
    db: Session = Depends(get_db),
):
    db_paper = crud.get_paper(db, paper_id=paper_id)
    if db_paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper_data = {
        "title": db_paper.title,
        "questions_snapshot": db_paper.questions_snapshot,
    }

    if format == "docx":
        file_stream = exporter.export_to_docx(paper_data, include_answers=include_answers)
        filename = f"exam_paper_{paper_id}.docx"
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif format == "pdf":
        file_stream = exporter.export_to_pdf(paper_data, include_answers=include_answers)
        filename = f"exam_paper_{paper_id}.pdf"
        media_type = "application/pdf"
    elif format == "txt":
        file_stream = exporter.export_to_txt(paper_data, include_answers=include_answers)
        filename = f"exam_paper_{paper_id}.txt"
        media_type = "text/plain; charset=utf-8"
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use docx/pdf/txt.")

    return StreamingResponse(
        file_stream,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
