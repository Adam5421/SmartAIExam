# Please install OpenAI SDK first: `pip3 install openai`

from openai import OpenAI
import os

# 1. 环境变量设置 (建议在终端通过 export DEEPSEEK_API_KEY="..." 设置，此处为演示直接读取)
# 假设环境变量已设置，若未设置则抛出异常
api_key = os.getenv("DEEPSEEK_API_KEY")
if not api_key:
    # 尝试从 .env 读取 (为了兼容项目当前状态)
    from dotenv import load_dotenv
    load_dotenv("kaoshi/backend/.env")
    api_key = os.getenv("OPENAI_API_KEY") # 项目中用的是 OPENAI_API_KEY
    if not api_key:
        print("Error: DEEPSEEK_API_KEY environment variable not set")
        exit(1)

print(f"Using API Key: {api_key[:4]}***")

# 2. API客户端配置
client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

try:
    # 3. API调用实现
    print("Sending request to DeepSeek API...")
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Hello"},
        ],
        stream=False
    )

    # 4. 结果处理
    print("\n=== Response ===")
    print(response.choices[0].message.content)

except Exception as e:
    print(f"\n❌ API Call Failed: {e}")
