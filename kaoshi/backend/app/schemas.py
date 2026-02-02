from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

# Question Schemas
class QuestionBase(BaseModel):
    content: str
    q_type: str  # single, multi, judge, essay
    options: Optional[List[str]] = None
    answer: Optional[str] = None
    analysis: Optional[str] = None
    difficulty: int = 1
    tags: Optional[List[str]] = None
    score: float = 1.0
    
    # New fields
    source_doc: Optional[str] = None
    page_num: Optional[int] = None
    chapter_num: Optional[str] = None
    clause_num: Optional[str] = None
    knowledge_points: Optional[List[str]] = None
    status: str = "draft"

class QuestionCreate(QuestionBase):
    pass

class QuestionUpdate(BaseModel):
    content: Optional[str] = None
    q_type: Optional[str] = None
    options: Optional[List[str]] = None
    answer: Optional[str] = None
    analysis: Optional[str] = None
    difficulty: Optional[int] = None
    tags: Optional[List[str]] = None
    score: Optional[float] = None
    
    # New fields update
    source_doc: Optional[str] = None
    page_num: Optional[int] = None
    chapter_num: Optional[str] = None
    clause_num: Optional[str] = None
    knowledge_points: Optional[List[str]] = None
    status: Optional[str] = None

class Question(QuestionBase):
    id: int
    custom_id: Optional[str] = None
    updated_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class QuestionListResponse(BaseModel):
    items: List[Question]
    total: int

class TagBase(BaseModel):
    name: str
    parent_id: Optional[int] = None

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None

class Tag(TagBase):
    id: int

    class Config:
        from_attributes = True

# Exam Rule Schemas
class ExamRuleBase(BaseModel):
    name: str
    total_score: float
    config: Dict[str, Any]

class ExamRuleCreate(ExamRuleBase):
    pass

class ExamRuleUpdate(BaseModel):
    name: Optional[str] = None
    total_score: Optional[float] = None
    config: Optional[Dict[str, Any]] = None

class ExamRule(ExamRuleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Exam Paper Schemas
class ExamPaperBase(BaseModel):
    title: str
    rule_id: Optional[int] = None

class ExamPaperCreate(ExamPaperBase):
    pass

class ExamPaper(ExamPaperBase):
    id: int
    questions_snapshot: List[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class GeneratePaperRequest(BaseModel):
    title: str = Field(min_length=1)
    rule_id: Optional[int] = None
    rule_config: Dict[str, Any]

class OperationLog(BaseModel):
    id: int
    user_id: Optional[str] = None
    action: str
    target_type: str
    target_ids: Optional[List[int]] = None
    details: Optional[Dict[str, Any]] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
