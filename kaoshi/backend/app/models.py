from sqlalchemy import Column, Integer, String, Text, JSON, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    custom_id = Column(String, unique=True, index=True, nullable=True) # New Custom ID: e.g. Q-20231027-0001
    content_hash = Column(String, unique=True, index=True, nullable=True) # Content MD5 hash for duplicate check
    content = Column(Text, nullable=False)
    q_type = Column(String, nullable=False)  # single, multi, judge, essay
    options = Column(JSON, nullable=True)    # For choice questions
    answer = Column(Text, nullable=True)     # Correct answer
    analysis = Column(Text, nullable=True)   # Explanation
    difficulty = Column(Integer, default=1)  # 1-5
    tags = Column(JSON, nullable=True)       # List of tags
    score = Column(Float, default=1.0)
    
    # New fields
    source_doc = Column(String, nullable=True)    # Source document name
    page_num = Column(Integer, nullable=True)     # Page number
    chapter_num = Column(String, nullable=True)   # Chapter number
    clause_num = Column(String, nullable=True)    # Clause number
    knowledge_points = Column(JSON, nullable=True) # List of knowledge points
    status = Column(String, default="draft")      # draft, review, published, archived, disabled
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Review fields
    review_comment = Column(Text, nullable=True)
    reviewer = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    parent_id = Column(Integer, nullable=True) # For hierarchy

class ExamRule(Base):
    __tablename__ = "exam_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    total_score = Column(Float, default=100.0)
    config = Column(JSON, nullable=False)    # Detailed distribution rules
    created_at = Column(DateTime, default=datetime.utcnow)

class ExamPaper(Base):
    __tablename__ = "exam_papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    rule_id = Column(Integer, nullable=True)
    questions_snapshot = Column(JSON, nullable=False) # List of full question objects to preserve state
    created_at = Column(DateTime, default=datetime.utcnow)

class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=True) # User ID or "system"
    action = Column(String, nullable=False) # batch_delete, batch_update, import, export
    target_type = Column(String, nullable=False) # question, tag, rule
    target_ids = Column(JSON, nullable=True) # List of affected IDs
    details = Column(JSON, nullable=True) # Details like "status changed to published" or "count: 50"
    status = Column(String, default="success") # success, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
