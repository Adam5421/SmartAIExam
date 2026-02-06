from typing import List, Optional, Union
from pydantic import BaseModel, field_validator

class AIGenerateRequest(BaseModel):
    text: str
    difficulty: int = 1
    # Config for each question type
    single_choice_count: int = 0
    multi_choice_count: int = 0
    judge_count: int = 0
    essay_count: int = 0
    tag_l1: Optional[str] = None
    tag_l2: Optional[str] = None

class AIGeneratedQuestion(BaseModel):
    content: str
    q_type: str
    options: Optional[List[str]] = None
    answer: str
    analysis: str
    difficulty: int
    tags: List[str]

    @field_validator('answer', mode='before')
    @classmethod
    def parse_answer(cls, v):
        if isinstance(v, list):
            return ",".join(str(x) for x in v)
        return str(v)
