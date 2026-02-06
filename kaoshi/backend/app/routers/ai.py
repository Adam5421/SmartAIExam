from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import List, Optional
from app.schemas_ai import AIGenerateRequest, AIGeneratedQuestion
from app.services.ai_service import AIService
from app.services.file_parser import FileParser
from app.limiter import limiter

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
)

@router.post("/parse_file")
@limiter.limit("10/minute")
async def parse_upload_file(request: Request, file: UploadFile = File(...)):
    """
    Parse uploaded file to text
    """
    try:
        text = await FileParser.parse_file(file)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/generate", response_model=List[AIGeneratedQuestion])
@limiter.limit("50/minute")
def generate_questions_by_ai(req: AIGenerateRequest, request: Request):
    """
    接收文本，调用 AI 生成题目。
    如果配置了 OPENAI_API_KEY，将调用真实模型；否则返回 Mock 数据。
    """
    try:
        # 使用通用 AIService 入口，内部自动判断使用 Real 或 Mock
        questions = AIService.generate_questions(
            text=req.text, 
            difficulty=req.difficulty,
            single_choice_count=req.single_choice_count,
            multi_choice_count=req.multi_choice_count,
            judge_count=req.judge_count,
            essay_count=req.essay_count,
            tag_l1=req.tag_l1,
            tag_l2=req.tag_l2
        )
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
