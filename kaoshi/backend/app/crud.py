from sqlalchemy.orm import Session
from sqlalchemy import func, case
from . import models, schemas
from datetime import datetime
from typing import List, Any

# ... existing code ...

def get_question(db: Session, question_id: int):
    return db.query(models.Question).filter(models.Question.id == question_id).first()

def get_question_by_hash(db: Session, content_hash: str):
    return db.query(models.Question).filter(models.Question.content_hash == content_hash).first()

def get_questions(db: Session, skip: int = 0, limit: int = 100, 
                  q_type: str = None, difficulty: int = None, 
                  tag: str = None, status: str = None):
    query = db.query(models.Question)
    if q_type:
        query = query.filter(models.Question.q_type == q_type)
    if difficulty:
        query = query.filter(models.Question.difficulty == difficulty)
    # Tag filtering needs JSON contains or similar logic if tags is JSON list
    # SQLite JSON support is limited in old versions, but generally works with cast or like
    if tag:
        # Simple LIKE for MVP if using JSON stored as string or simple JSON
        # For Postgres we use .contains, for SQLite/MySQL it varies. 
        # Assuming simple string match for now or proper JSON operator if supported.
        # Given earlier code used simple list, we'll skip complex tag logic or assume exact match?
        # Let's rely on Python filtering if DB is simple, or implementation in router.
        # But here is CRUD.
        pass 
    if status:
        query = query.filter(models.Question.status == status)
        
    return query.offset(skip).limit(limit).all()

def get_questions_with_count(
    db: Session, skip: int = 0, limit: int = 100, 
    q_type: str = None, difficulty: int = None, 
    tag: str = None, search: str = None, 
    status: str = None, source_doc: str = None,
    review_status: str = None
):
    query = db.query(models.Question)
    
    if q_type: query = query.filter(models.Question.q_type == q_type)
    if difficulty: query = query.filter(models.Question.difficulty == difficulty)
    if status: query = query.filter(models.Question.status == status)
    if source_doc: query = query.filter(models.Question.source_doc == source_doc)
    if search:
        query = query.filter(models.Question.content.contains(search))
    
    # review_status logic if different from status
    if review_status:
        query = query.filter(models.Question.status == review_status)

    total = query.count()
    items = query.order_by(models.Question.id.desc()).offset(skip).limit(limit).all()
    return items, total

def calculate_content_hash(content: str):
    import hashlib
    return hashlib.md5(content.strip().encode('utf-8')).hexdigest()

def check_content_similarity(db: Session, content: str, threshold: float = 0.8):
    # This is a placeholder. Real similarity requires vector DB or Levenshtein
    # For MVP, we just return empty or simple substring match
    return []

def create_question(db: Session, question: schemas.QuestionCreate):
    data = question.dict()
    # Ensure content_hash
    content_hash = calculate_content_hash(data['content'])
    
    # Custom ID generation (simple timestamp based)
    def generate_custom_id(db, q_type):
        prefix = q_type[0].upper()
        date_str = datetime.now().strftime("%Y%m%d")
        # Count existing for today to append sequence? 
        # Or just random. Let's use simple sequence if possible, or UUID.
        # For performance, just Random or Time
        import random
        seq = random.randint(1000, 9999)
        return f"{prefix}-{date_str}-{seq}"

    custom_id = generate_custom_id(db, data.get('q_type', 'single'))
    
    db_question = models.Question(**data, custom_id=custom_id, content_hash=content_hash)
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question

def review_question(db: Session, question_id: int, status: str, comment: str = None, reviewer: str = None):
    q = get_question(db, question_id)
    if not q:
        return None
    q.status = status
    q.review_comment = comment
    q.reviewer = reviewer
    q.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q

def update_question(db: Session, question_id: int, question: schemas.QuestionUpdate):
    db_question = get_question(db, question_id)
    if not db_question:
        return None
    update_data = question.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_question, key, value)
    db.commit()
    db.refresh(db_question)
    return db_question

def delete_question(db: Session, question_id: int):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if db_question:
        db.delete(db_question)
        db.commit()
    return db_question

# Batch Operations
def batch_delete_questions(db: Session, ids: List[int]):
    db.query(models.Question).filter(models.Question.id.in_(ids)).delete(synchronize_session=False)
    db.commit()

def batch_update_status(db: Session, ids: List[int], status: str, comment: str = None):
    # If comment is provided, we need to update it too.
    # update() supports multiple columns
    values = {models.Question.status: status}
    if comment is not None:
        values[models.Question.review_comment] = comment
        values[models.Question.reviewed_at] = datetime.utcnow()
        values[models.Question.reviewer] = "Admin" # Default reviewer
        
    db.query(models.Question).filter(models.Question.id.in_(ids)).update(values, synchronize_session=False)
    db.commit()

def batch_update_difficulty(db: Session, ids: List[int], difficulty: int):
    db.query(models.Question).filter(models.Question.id.in_(ids)).update({models.Question.difficulty: difficulty}, synchronize_session=False)
    db.commit()

def batch_update_tags(db: Session, ids: List[int], tags: List[str]):
    # Updating JSON column in batch might vary by DB
    # For SQLite/Postgres with SQLAlchemy, simple assignment works
    db.query(models.Question).filter(models.Question.id.in_(ids)).update({models.Question.tags: tags}, synchronize_session=False)
    db.commit()

def batch_review_questions(db: Session, items: List[Any]):
    # items is List[BatchItem] or dicts
    # We want to update status and review_comment per ID
    # Use mappings for bulk update
    
    mappings = []
    now = datetime.utcnow()
    for item in items:
        mappings.append({
            "id": item.id,
            "status": item.value, # value holds the status
            "review_comment": item.comment,
            "reviewed_at": now,
            "reviewer": "Admin"
        })
    
    db.bulk_update_mappings(models.Question, mappings)
    db.commit()

# Tag CRUD
def get_tags(db: Session, skip: int = 0, limit: int = 1000):
    return db.query(models.Tag).offset(skip).limit(limit).all()

def create_tag(db: Session, tag: schemas.TagCreate):
    db_tag = models.Tag(**tag.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def update_tag(db: Session, tag_id: int, tag: schemas.TagUpdate):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not db_tag:
        return None
    update_data = tag.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tag, key, value)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def delete_tag(db: Session, tag_id: int):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        db.delete(db_tag)
        db.commit()
    return db_tag

# Rule CRUD
def get_rules(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ExamRule).offset(skip).limit(limit).all()

def get_rule(db: Session, rule_id: int):
    return db.query(models.ExamRule).filter(models.ExamRule.id == rule_id).first()

def create_rule(db: Session, rule: schemas.ExamRuleCreate):
    db_rule = models.ExamRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def update_rule(db: Session, rule_id: int, rule: schemas.ExamRuleUpdate):
    db_rule = get_rule(db, rule_id)
    if not db_rule:
        return None
    update_data = rule.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rule, key, value)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def delete_rule(db: Session, rule_id: int):
    db_rule = get_rule(db, rule_id)
    if db_rule:
        db.delete(db_rule)
        db.commit()
    return db_rule

# Paper CRUD
def create_paper(db: Session, paper: schemas.ExamPaperCreate, questions: list):
    # Serialize questions to store as snapshot
    questions_data = [
        {
            "id": q.id,
            "content": q.content,
            "q_type": q.q_type,
            "options": q.options,
            "answer": q.answer,
            "analysis": q.analysis,
            "score": q.score,
            "difficulty": q.difficulty,
            "tags": q.tags,
        } for q in questions
    ]
    
    db_paper = models.ExamPaper(
        title=paper.title,
        rule_id=paper.rule_id,
        questions_snapshot=questions_data
    )
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)
    return db_paper

def get_paper(db: Session, paper_id: int):
    return db.query(models.ExamPaper).filter(models.ExamPaper.id == paper_id).first()

def list_papers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ExamPaper).order_by(models.ExamPaper.id.desc()).offset(skip).limit(limit).all()

# Operation Logs
def create_operation_log(
    db: Session, 
    action: str, 
    target_type: str, 
    target_ids: List[int] = None, 
    details: dict = None,
    user_id: str = "system",
    status: str = "success",
    error_message: str = None
):
    log = models.OperationLog(
        action=action,
        target_type=target_type,
        target_ids=target_ids,
        details=details,
        user_id=user_id,
        status=status,
        error_message=error_message
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_operation_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.OperationLog).order_by(models.OperationLog.created_at.desc()).offset(skip).limit(limit).all()
