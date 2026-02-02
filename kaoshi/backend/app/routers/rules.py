from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, database

router = APIRouter(
    prefix="/rules",
    tags=["rules"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.ExamRule)
def create_rule(rule: schemas.ExamRuleCreate, db: Session = Depends(get_db)):
    return crud.create_rule(db=db, rule=rule)

@router.get("/", response_model=List[schemas.ExamRule])
def list_rules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_rules(db=db, skip=skip, limit=limit)

@router.get("/{rule_id}", response_model=schemas.ExamRule)
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = crud.get_rule(db=db, rule_id=rule_id)
    if db_rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    return db_rule

@router.put("/{rule_id}", response_model=schemas.ExamRule)
def update_rule(rule_id: int, rule: schemas.ExamRuleUpdate, db: Session = Depends(get_db)):
    db_rule = crud.update_rule(db=db, rule_id=rule_id, rule=rule)
    if db_rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    return db_rule

@router.delete("/{rule_id}", response_model=schemas.ExamRule)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = crud.delete_rule(db=db, rule_id=rule_id)
    if db_rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    return db_rule

