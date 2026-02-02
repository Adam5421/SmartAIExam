# 智能出题与试卷导出（MVP）

本项目实现 PRD 中“试卷导出模式”的核心链路：题库管理 → 规则配置 → 自动组卷 → 预览 → 导出（Word/PDF/TXT）。当前阶段不包含在线考试功能。

## 目录结构

- [backend](file:///Users/yoko/Documents/trae_projects/Test/kaoshi/backend)：FastAPI 后端（SQLite）
- [frontend](file:///Users/yoko/Documents/trae_projects/Test/kaoshi/frontend)：React + Ant Design 管理端
- [DESIGN.md](file:///Users/yoko/Documents/trae_projects/Test/kaoshi/DESIGN.md)：系统设计说明

## 环境要求

- Python 3.8+（本仓库当前在 Python 3.8.2 验证通过）
- Node.js 20.19.0+（Vite 7 需要）

## 启动后端

```bash
cd kaoshi/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=$PYTHONPATH:$(pwd)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API 文档：
- Swagger：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`

## 启动前端

```bash
cd kaoshi/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

前端访问：`http://localhost:5173/`

说明：前端通过 Vite Proxy 将 `/api/*` 转发到 `http://127.0.0.1:8000/*`（见 [vite.config.ts](file:///Users/yoko/Documents/trae_projects/Test/kaoshi/frontend/vite.config.ts)）。

## 端到端流程

1. 进入“题库管理”，新增若干题目（至少满足规则中各题型数量需求）
2. 进入“规则配置”，新增规则（JSON）
3. 进入“组卷与导出”，选择规则并生成试卷
4. 在预览抽屉中点击导出（Word/PDF/TXT）

## 测试

后端测试（MVP 级别）：

```bash
cd kaoshi/backend
source venv/bin/activate
export PYTHONPATH=$PYTHONPATH:$(pwd)
python3 tests/test_flow.py
python3 tests/test_exporter.py
```

