import json
import sys
import os

# Add parent dir to path to import app if needed, but we will test via API requests 
# assuming server is running OR we can test functions directly.
# Let's test functions directly to avoid needing to spawn uvicorn in background.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app import models, crud, schemas
from app.services.engine import AssemblyEngine

# Setup Test DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def test_workflow():
    print("Initializing Test DB...")
    init_db()
    db = TestingSessionLocal()
    
    try:
        # 1. Add Questions
        print("Adding sample questions...")
        q_types = ["single", "single", "single", "multi", "judge", "essay"]
        difficulties = [1, 2, 3, 1, 2, 3]
        
        for i, (qt, diff) in enumerate(zip(q_types, difficulties)):
            q = schemas.QuestionCreate(
                content=f"Question {i+1} ({qt}, diff={diff})",
                q_type=qt,
                difficulty=diff,
                options=["A", "B", "C", "D"] if qt in ["single", "multi"] else None,
                answer="A",
                score=2.0
            )
            crud.create_question(db, q)
            
        # 2. Test Engine
        print("Testing Assembly Engine...")
        engine_svc = AssemblyEngine(db)
        
        rule_config = {
            "type_distribution": {
                "single": 2,
                "essay": 1
            },
            "difficulty_distribution": {
                "1": 0.5, 
                "2": 0.5
            }
        }
        
        questions = engine_svc.generate_paper(rule_config)
        print(f"Generated {len(questions)} questions.")
        
        for q in questions:
            print(f" - [{q.q_type}] Diff:{q.difficulty} | {q.content}")
            
        # Verify counts
        singles = [q for q in questions if q.q_type == "single"]
        essays = [q for q in questions if q.q_type == "essay"]
        
        assert len(singles) == 2, f"Expected 2 singles, got {len(singles)}"
        assert len(essays) == 1, f"Expected 1 essay, got {len(essays)}"
        
        # 3. Save Paper
        print("Saving Paper...")
        paper_in = schemas.ExamPaperCreate(title="Test Paper 1")
        paper = crud.create_paper(db, paper_in, questions)
        print(f"Paper saved: ID={paper.id}, Title={paper.title}")
        print(f"Snapshot has {len(paper.questions_snapshot)} questions.")
        
        print("\n✅ Workflow Test Passed!")
        
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
        raise e
    finally:
        db.close()
        # Clean up
        if os.path.exists("./test.db"):
            os.remove("./test.db")

if __name__ == "__main__":
    test_workflow()
