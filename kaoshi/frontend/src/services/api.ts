import axios from 'axios'

export type QuestionType = 'single' | 'multi' | 'judge' | 'essay'

export interface Question {
  id: number
  content: string
  q_type: QuestionType
  options?: string[] | null
  answer?: string | null
  analysis?: string | null
  difficulty: number
  tags?: string[] | null
  score: number
  // New fields
  source_doc?: string | null
  page_num?: number | null
  chapter_num?: string | null
  clause_num?: string | null
  knowledge_points?: string[] | null
  status?: string | null
  custom_id?: string | null
  review_comment?: string | null
  reviewer?: string | null
  reviewed_at?: string | null
  updated_at?: string | null
  created_at: string
}

export interface QuestionCreate {
  content: string
  q_type: QuestionType
  options?: string[] | null
  answer?: string | null
  analysis?: string | null
  difficulty: number
  tags?: string[] | null
  score: number
  // New fields
  source_doc?: string | null
  page_num?: number | null
  chapter_num?: string | null
  clause_num?: string | null
  knowledge_points?: string[] | null
  status?: string | null
}

export interface Rule {
  id: number
  name: string
  total_score: number
  config: Record<string, unknown>
  created_at: string
}

export interface RuleCreate {
  name: string
  total_score: number
  config: Record<string, unknown>
}

export interface Paper {
  id: number
  title: string
  rule_id?: number | null
  questions_snapshot: Array<Record<string, unknown>>
  created_at: string
}

export interface GeneratePaperRequest {
  title: string
  rule_id?: number | null
  rule_config: Record<string, unknown>
}

export interface Tag {
  id: number
  name: string
  parent_id?: number | null
}

export interface TagCreate {
  name: string
  parent_id?: number | null
}

export async function listTags(): Promise<Tag[]> {
  const res = await api.get<Tag[]>('/tags/')
  return res.data
}

export async function createTag(payload: TagCreate): Promise<Tag> {
  const res = await api.post<Tag>('/tags/', payload)
  return res.data
}

export async function updateTag(id: number, payload: TagCreate): Promise<Tag> {
  const res = await api.put<Tag>(`/tags/${id}`, payload)
  return res.data
}

export async function deleteTag(id: number): Promise<Tag> {
  const res = await api.delete<Tag>(`/tags/${id}`)
  return res.data
}

const api = axios.create({
  baseURL: '/api',
  timeout: 300_000, // 5 minutes timeout for AI generation
  headers: {
    'X-Role': 'admin' // Mock admin role for permission control
  }
})

export interface QuestionListResponse {
  items: Question[]
  total: number
}

export async function listQuestions(params?: {
  skip?: number
  limit?: number
  q_type?: string
  difficulty?: number
  tag?: string
  search?: string
  status?: string
  source_doc?: string
  review_status?: 'pending' | 'approved' | 'rejected'
}): Promise<QuestionListResponse> {
  const res = await api.get<QuestionListResponse>('/questions/', { params })
  return res.data
}

export async function reviewQuestion(id: number, payload: {
  status: string
  comment?: string
  reviewer?: string
}): Promise<Question> {
  const res = await api.post<Question>(`/questions/${id}/review`, payload)
  return res.data
}

export interface BatchItem {
  id: number
  value?: string | number | null
  comment?: string
}

export async function batchOperateQuestions(payload: {
  ids?: number[]
  action: 'delete' | 'update_status' | 'update_difficulty' | 'update_tags'
  value?: string | number | string[] | null
  items?: BatchItem[]
  comment?: string
}): Promise<{ msg: string }> {
  return (await api.post('/questions/batch', payload)).data
}

export async function batchCreateQuestions(payload: { questions: QuestionCreate[] }): Promise<Question[]> {
  const res = await api.post<Question[]>('/questions/batch_create', payload)
  return res.data
}

export async function checkDuplicate(content: string, threshold: number = 0.8): Promise<{ similar_questions: Array<{ id: number, content: string, score: number }> }> {
  const res = await api.post('/questions/check_duplicate', { content, threshold })
  return res.data
}

export async function createQuestion(payload: QuestionCreate): Promise<Question> {
  const res = await api.post<Question>('/questions/', payload)
  return res.data
}

export async function updateQuestion(id: number, payload: Partial<QuestionCreate>): Promise<Question> {
  const res = await api.put<Question>(`/questions/${id}`, payload)
  return res.data
}

export async function deleteQuestion(id: number): Promise<Question> {
  const res = await api.delete<Question>(`/questions/${id}`)
  return res.data
}

export async function listRules(): Promise<Rule[]> {
  const res = await api.get<Rule[]>('/rules/')
  return res.data
}

export async function createRule(payload: RuleCreate): Promise<Rule> {
  const res = await api.post<Rule>('/rules/', payload)
  return res.data
}

export async function updateRule(id: number, payload: Partial<RuleCreate>): Promise<Rule> {
  const res = await api.put<Rule>(`/rules/${id}`, payload)
  return res.data
}

export async function deleteRule(id: number): Promise<Rule> {
  const res = await api.delete<Rule>(`/rules/${id}`)
  return res.data
}

export async function listPapers(): Promise<Paper[]> {
  const res = await api.get<Paper[]>('/papers/')
  return res.data
}

export async function getPaper(id: number): Promise<Paper> {
  const res = await api.get<Paper>(`/papers/${id}`)
  return res.data
}

export async function generatePaper(payload: GeneratePaperRequest): Promise<Paper> {
  const res = await api.post<Paper>('/papers/generate', payload)
  return res.data
}

export function getExportUrl(paperId: number, format: 'docx' | 'pdf' | 'txt', includeAnswers: boolean): string {
  const search = new URLSearchParams()
  search.set('format', format)
  search.set('include_answers', includeAnswers ? 'true' : 'false')
  return `/api/papers/${paperId}/export?${search.toString()}`
}

export interface AIGeneratedQuestion {
  content: string
  q_type: string
  options?: string[] | null
  answer: string
  analysis: string
  difficulty: number
  tags: string[]
}

export async function parseFile(file: File): Promise<{ text: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/ai/parse_file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function generateAIQuestions(payload: {
  text: string
  difficulty: number
  single_choice_count?: number
  multi_choice_count?: number
  judge_count?: number
  essay_count?: number
}): Promise<AIGeneratedQuestion[]> {
  const res = await api.post<AIGeneratedQuestion[]>('/ai/generate', payload)
  return res.data
}

export interface OperationLog {
  id: number
  user_id?: string
  action: string
  target_type: string
  target_ids?: number[] | null
  details?: Record<string, unknown> | null
  status: string
  error_message?: string | null
  created_at: string
}

export async function listLogs(skip = 0, limit = 100): Promise<OperationLog[]> {
  const res = await api.get<OperationLog[]>('/logs/', { params: { skip, limit } })
  return res.data
}

export async function exportQuestions(params: {
  q_type?: string
  difficulty?: number
  tag?: string
  status?: string
}) {
  const res = await api.post('/questions/export', null, {
    params,
    responseType: 'blob'
  })
  return res.data
}

export interface ImportResponse {
  success: number
  failed: number
  errors: string[]
}

export interface ParsedItem {
  row_index: number
  status: 'valid' | 'invalid' | 'duplicate' | 'error'
  errors: string[]
  existing_id?: number
  data: QuestionCreate
}

export interface ParseImportResponse {
  filename: string
  total: number
  items: ParsedItem[]
}

export async function parseImportFile(file: File): Promise<ParseImportResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post<ParseImportResponse>('/questions/parse_import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function importQuestions(file: File): Promise<ImportResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post<ImportResponse>('/questions/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

