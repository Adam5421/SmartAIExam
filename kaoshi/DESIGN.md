# Smart Exam System - Technical Design Document

## 1. System Architecture

The system adopts a **Separation of Concerns** architecture with a RESTful API backend and a Single Page Application (SPA) frontend.

### 1.1 Tech Stack
- **Backend**: Python 3.10+ with **FastAPI**
  - High performance, auto-generated API docs (Swagger UI).
  - **SQLAlchemy** (ORM) + **SQLite** (Database) for portability and ease of delivery.
  - **Pydantic** for data validation.
  - **python-docx** and **reportlab** for file export.
- **Frontend**: **React** (Vite) + **Ant Design**
  - Component-based UI.
  - Rich set of admin components (Tables, Forms) from Ant Design.
  - **Axios** for API communication.

### 1.2 Directory Structure
```
smart-exam/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # Entry point
│   │   ├── models.py         # Database Models
│   │   ├── schemas.py        # Pydantic Schemas
│   │   ├── crud.py           # Database Access Layer
│   │   ├── database.py       # DB Connection
│   │   ├── services/         # Business Logic
│   │   │   ├── engine.py     # Exam Assembly Engine
│   │   │   └── exporter.py   # File Export Logic
│   │   └── routers/          # API Controllers
│   │       ├── questions.py
│   │       ├── papers.py
│   │       └── rules.py
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.tsx
│   └── package.json
├── README.md
└── DESIGN.md
```

## 2. Database Design (SQLite)

### 2.1 Tables

#### `questions`
Stores the question bank data.
- `id`: Integer, PK
- `content`: Text (Question stem)
- `q_type`: String (Enum: single, multi, judge, essay)
- `options`: JSON (List of options for choice questions)
- `answer`: Text (Correct answer)
- `analysis`: Text (Explanation)
- `difficulty`: Integer (1-5)
- `tags`: JSON (List of strings, e.g., ["Math", "Algebra"])
- `score`: Float (Default score)
- `created_at`: DateTime

#### `exam_rules`
Stores the configuration for generating papers.
- `id`: Integer, PK
- `name`: String (e.g., "Midterm Template A")
- `total_score`: Float
- `config`: JSON
  - Structure:
    ```json
    {
      "question_count": 50,
      "difficulty_distribution": { "1": 0.2, "2": 0.3, ... },
      "type_distribution": { "single": 20, "essay": 5 },
      "tags_included": ["Chapter1", "Chapter2"]
    }
    ```

#### `exam_papers`
Stores generated papers.
- `id`: Integer, PK
- `title`: String
- `rule_id`: Integer (FK)
- `questions_snapshot`: JSON (Stores the list of selected Question IDs or full content to preserve state)
- `created_at`: DateTime

## 3. Core Modules Implementation Path

### 3.1 Question Bank Management
- **API**: `GET /questions`, `POST /questions`, `PUT /questions/{id}`, `DELETE /questions/{id}`
- **Logic**: Standard CRUD. Support filtering by type, difficulty, tags.

### 3.2 Smart Assembly Engine (`services/engine.py`)
- **Input**: `ExamRule` config.
- **Algorithm**:
  1. Fetch candidate questions matching hard constraints (Tags, Type).
  2. Shuffle candidates.
  3. Select questions to match `difficulty_distribution` and `type_distribution`.
  4. If exact match impossible, use "Best Fit" strategy (closest distribution).
  5. Return list of selected questions.

### 3.3 Paper Export (`services/exporter.py`)
- **Input**: `ExamPaper` object (with question details).
- **Formats**:
  - **Word (.docx)**: Use `python-docx`. Create a document, iterate through questions, format text, options, and leave space for answers. Append "Answer Key" at the end.
  - **PDF (.pdf)**: Use `reportlab` to render a simple A4 layout.
  - **Text (.txt)**: Simple string concatenation.

### 3.4 Frontend
- **Question Page**: Table with search filters + Modal for Add/Edit.
- **Rule Page**: Form to set numbers/sliders for distributions.
- **Generate/Preview Page**: Dropdown to select Rule -> Click "Generate" -> Show Paper Preview -> Click "Export".

## 4. API Interface Design

| Method | Endpoint | Description |
|------|----------|-------------|
| GET | `/questions/` | List questions (pagination, filters) |
| POST | `/questions/` | Create question |
| PUT | `/questions/{id}` | Update question |
| DELETE | `/questions/{id}` | Delete question |
| GET | `/rules/` | List rules |
| POST | `/rules/` | Create rule |
| PUT | `/rules/{id}` | Update rule |
| DELETE | `/rules/{id}` | Delete rule |
| GET | `/papers/` | List papers |
| POST | `/papers/generate` | Generate a paper based on rule config |
| GET | `/papers/{id}` | Get paper details |
| GET | `/papers/{id}/export?format=docx|pdf|txt&include_answers=true|false` | Download exported file |
