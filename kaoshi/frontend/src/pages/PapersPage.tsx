import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Checkbox, Divider, Drawer, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { generatePaper, getExportUrl, getPaper, listPapers, listRules } from '../services/api'
import type { Paper, Rule } from '../services/api'

const TYPE_MAP: Record<string, string> = {
  single: '单选',
  multi: '多选',
  judge: '判断',
  essay: '简答',
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

export default function PapersPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null)
  const [includeAnswers, setIncludeAnswers] = useState(true)
  const [form] = Form.useForm()

  async function refresh() {
    const [rulesData, papersData] = await Promise.all([listRules(), listPapers()])
    setRules(rulesData)
    setPapers(papersData)
  }

  useEffect(() => {
    refresh().catch(() => message.error('加载失败'))
  }, [])

  const columns: ColumnsType<Paper> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      { title: '标题', dataIndex: 'title', width: 260 },
      {
        title: '题量',
        render: (_, record) => <Tag>{record.questions_snapshot?.length ?? 0}</Tag>,
        width: 100,
      },
      {
        title: '操作',
        width: 200,
        render: (_, record) => (
          <Space>
            <Button
              size="small"
              onClick={async () => {
                const p = await getPaper(record.id)
                setCurrentPaper(p)
                setPreviewOpen(true)
              }}
            >
              预览
            </Button>
            <Button size="small" href={getExportUrl(record.id, 'docx', includeAnswers)} target="_blank">
              导出Word
            </Button>
          </Space>
        ),
      },
    ],
    [includeAnswers],
  )

  async function onGenerate() {
    const values = await form.validateFields()
    const rule = rules.find((r) => r.id === values.rule_id)
    if (!rule) {
      message.error('请选择规则')
      return
    }
    setLoading(true)
    try {
      const paper = await generatePaper({
        title: values.title,
        rule_id: rule.id,
        rule_config: rule.config ?? {},
      })
      setCurrentPaper(paper)
      setPreviewOpen(true)
      message.success('组卷成功')
      refresh()
    } catch {
      message.error('组卷失败：请检查题库数量与规则约束')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Card>
        <Form form={form} layout="inline">
          <Form.Item name="title" rules={[{ required: true, message: '请输入试卷标题' }]}>
            <Input style={{ width: 260 }} placeholder="试卷标题" />
          </Form.Item>
          <Form.Item name="rule_id" rules={[{ required: true, message: '请选择规则' }]}>
            <Select
              style={{ width: 260 }}
              placeholder="选择规则"
              options={rules.map((r) => ({ value: r.id, label: `${r.id} - ${r.name}` }))}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={loading} onClick={onGenerate}>
              生成试卷
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={() => refresh().catch(() => message.error('刷新失败'))}>刷新</Button>
          </Form.Item>
          <Form.Item>
            <Checkbox checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)}>
              导出包含答案与解析
            </Checkbox>
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        历史试卷
      </Typography.Title>
      <Table<Paper> rowKey="id" columns={columns} dataSource={papers} pagination={{ pageSize: 10 }} />

      <Drawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width={820}
        title={currentPaper ? `预览：${currentPaper.title}` : '预览'}
        extra={
          currentPaper ? (
            <Space>
              <Button href={getExportUrl(currentPaper.id, 'docx', includeAnswers)} target="_blank">
                导出Word
              </Button>
              <Button href={getExportUrl(currentPaper.id, 'pdf', includeAnswers)} target="_blank">
                导出PDF
              </Button>
              <Button href={getExportUrl(currentPaper.id, 'txt', includeAnswers)} target="_blank">
                导出TXT
              </Button>
            </Space>
          ) : null
        }
      >
        {currentPaper ? (
          <div>
            <Typography.Paragraph type="secondary">题目预览（顺序即导出顺序）</Typography.Paragraph>
            <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
              {(currentPaper.questions_snapshot ?? []).map((q: Record<string, unknown>, idx) => {
                const qid = q['id']
                const qType = String(q['q_type'] ?? 'Unknown')
                const content = String(q['content'] ?? '')
                const options = Array.isArray(q['options']) ? (q['options'] as string[]) : []
                return (
                  <div key={String(qid ?? idx)} style={{ marginBottom: 16 }}>
                  <Typography.Text strong>
                    {idx + 1}. [{TYPE_MAP[qType] || qType}] {content}
                  </Typography.Text>
                  {options.length > 0 ? (
                    <div style={{ marginTop: 6, paddingLeft: 12 }}>
                      {options.map((opt: string, i: number) => (
                        <div key={`${String(qid ?? idx)}-${i}`}>
                          <Typography.Text>{opt}</Typography.Text>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                )
              })}
            </div>

            <Divider />

            <Typography.Title level={5}>组卷规则快照（JSON）</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {safeJsonStringify(
                rules.find((r) => r.id === currentPaper.rule_id)?.config ?? {},
              )}
            </Typography.Paragraph>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
