import random
import os
import json
from typing import List
from pydantic import BaseModel
from app.schemas_ai import AIGeneratedQuestion
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from typing import List, Optional

class QuestionResponse(BaseModel):
    questions: List[AIGeneratedQuestion]

class AIService:
    @staticmethod
    def generate_questions(
        text: str, 
        difficulty: int = 1,
        single_choice_count: int = 0,
        multi_choice_count: int = 0,
        judge_count: int = 0,
        essay_count: int = 0,
        tag_l1: Optional[str] = None,
        tag_l2: Optional[str] = None
    ) -> List[AIGeneratedQuestion]:
        """
        调用 LLM 生成题目。
        使用 AGNO 框架。
        """
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        
        # Calculate total required
        total_questions = single_choice_count + multi_choice_count + judge_count + essay_count
        if total_questions == 0:
            # Default fallback if no specific counts provided
            single_choice_count = 3
            total_questions = 3

        generated_questions = []

        if api_key:
            try:
                req_desc = []
                if single_choice_count > 0: req_desc.append(f"{single_choice_count} 道单选题 (single)")
                if multi_choice_count > 0: req_desc.append(f"{multi_choice_count} 道多选题 (multi)")
                if judge_count > 0: req_desc.append(f"{judge_count} 道判断题 (judge)")
                if essay_count > 0: req_desc.append(f"{essay_count} 道简答题 (essay)")
                
                req_str = ", ".join(req_desc)

                prompt = f"""
                你是一个专业的出题老师。请根据以下文本内容生成 {total_questions} 道题目。
                文本内容：【{text[:3000]}...】 (内容过长已截断)
                
                具体要求如下：
                1. 难度系数：{difficulty} (1-5，1为最简单)
                2. 题型分布：{req_str}。
                3. 请严格按照定义的结构返回数据。
                """
                
                agent = Agent(
                    model=OpenAIChat(
                        id=model,
                        api_key=api_key,
                        base_url=base_url,
                        role_map={
                            "system": "system",
                            "user": "user",
                            "assistant": "assistant",
                            "tool": "tool",
                        },
                    ),
                    description="你是一个专业的出题老师。",
                    output_schema=QuestionResponse,
                    use_json_mode=True,
                )

                response = agent.run(prompt)
                generated_questions = response.content.questions

            except Exception as e:
                import traceback
                error_msg = f"AI 调用失败: {str(e)}\n{traceback.format_exc()}"
                print(error_msg)
                # Fallback to mock with error details
                generated_questions = [
                    AIGeneratedQuestion(
                        content=f"❌ AI 调用出错: {str(e)}",
                        q_type="single",
                        options=["A. 请检查后端日志", "B. 请检查 API Key", "C. 请检查网络", "D. DeepSeek 服务可能繁忙"],
                        answer="A",
                        analysis=f"详细错误信息已打印到后端控制台。\n使用的 Base URL: {base_url}\n使用的 Model: {model}\nAPI Key 前4位: {api_key[:4] if api_key else 'None'}",
                        difficulty=1,
                        tags=["系统错误"]
                    )
                ]
        else:
            print("未检测到 OPENAI_API_KEY，回退到 Mock 模式")
            generated_questions = MockAIService.generate_questions(text, total_questions, difficulty)

        # Apply manual tags if provided
        manual_tags = []
        if tag_l1: manual_tags.append(tag_l1)
        if tag_l2: manual_tags.append(tag_l2)
        
        if manual_tags:
            for q in generated_questions:
                q.tags = manual_tags
        
        return generated_questions

class MockAIService:
    @staticmethod
    def generate_questions(text: str, num_questions: int = 3, difficulty: int = 1) -> List[AIGeneratedQuestion]:
        """
        模拟 AI 生成题目 (Fallback)。
        """
        results = []
        
        # 1. 模拟单选题
        if num_questions >= 1:
            q1 = AIGeneratedQuestion(
                content=f"【Mock模式】根据输入内容【{text[:10]}...】，以下哪个描述是正确的？(请配置 API Key 以获取真实结果)",
                q_type="single",
                options=["A. 这是一个测试选项1", "B. 这是一个测试选项2", "C. 这是一个测试选项3", "D. 这是一个测试选项4"],
                answer="A",
                analysis="这是一个Mock解析：当前系统未检测到 OPENAI_API_KEY，因此展示模拟数据。",
                difficulty=difficulty,
                tags=["Mock数据", "需配置Key"]
            )
            results.append(q1)

        # 2. 模拟判断题
        if num_questions >= 2:
            q2 = AIGeneratedQuestion(
                content=f"【Mock模式】输入文本是否包含关键词？",
                q_type="judge",
                options=None,
                answer="正确",
                analysis="这是一个Mock解析：文本确实包含关键词。",
                difficulty=difficulty,
                tags=["Mock数据", "需配置Key"]
            )
            results.append(q2)

        # 3. 模拟填空/多选/其他（随机补充）
        for i in range(2, num_questions):
            q_mock = AIGeneratedQuestion(
                content=f"【Mock模式】第 {i+1} 道题目：关于 {text[:5]} 的深入分析",
                q_type="single",
                options=["A. 观点1", "B. 观点2", "C. 观点3", "D. 观点4"],
                answer=random.choice(["A", "B", "C", "D"]),
                analysis=f"这是第 {i+1} 题的解析。",
                difficulty=difficulty,
                tags=["Mock数据", "需配置Key"]
            )
            results.append(q_mock)

        return results
