from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app import crud, database, schemas

router = APIRouter(
    prefix="/logs",
    tags=["logs"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=List[schemas.OperationLog])
def read_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_operation_logs(db, skip=skip, limit=limit)
