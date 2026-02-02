import sys
import os
# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app import models, crud, schemas
from app.routers.questions import BatchItem

# Setup Test DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_batch.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def test_batch():
    print("Initializing Test DB...")
    init_db()
    db = TestingSessionLocal()
    
    try:
        # 1. Create 3 questions
        q1 = crud.create_question(db, schemas.QuestionCreate(content="Q1", q_type="single", difficulty=1, score=1, status="review"))
        q2 = crud.create_question(db, schemas.QuestionCreate(content="Q2", q_type="single", difficulty=1, score=1, status="review"))
        q3 = crud.create_question(db, schemas.QuestionCreate(content="Q3", q_type="single", difficulty=1, score=1, status="review"))
        
        print(f"Created Q1:{q1.id}, Q2:{q2.id}, Q3:{q3.id}")

        # 2. Test Unified Batch Update (Pass)
        print("Testing Unified Batch Update...")
        crud.batch_update_status(db, [q1.id], "published", "Unified Good")
        
        db.refresh(q1)
        assert q1.status == "published"
        assert q1.review_comment == "Unified Good"
        print("Unified Update Passed")

        # 3. Test Individual Batch Update
        print("Testing Individual Batch Update...")
        items = [
            BatchItem(id=q2.id, value="published", comment="Indiv Good"),
            BatchItem(id=q3.id, value="needs_modification", comment="Indiv Bad")
        ]
        # Need to convert Pydantic models to dicts or objects compatible with crud
        # crud.batch_review_questions expects list of objects with .id, .value, .comment attributes
        # BatchItem matches this.
        crud.batch_review_questions(db, items)
        
        db.refresh(q2)
        db.refresh(q3)
        
        assert q2.status == "published"
        assert q2.review_comment == "Indiv Good"
        assert q3.status == "needs_modification"
        assert q3.review_comment == "Indiv Bad"
        print("Individual Update Passed")
        
        print("\n✅ Batch Test Passed!")
        
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()
        if os.path.exists("./test_batch.db"):
            os.remove("./test_batch.db")

if __name__ == "__main__":
    test_batch()
