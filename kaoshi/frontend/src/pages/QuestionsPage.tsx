import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  TreeSelect,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import {
  checkDuplicate,
  createQuestion,
  deleteQuestion,
  listQuestions,
  updateQuestion,
  batchOperateQuestions,
  reviewQuestion,
  listTags,
  exportQuestions,
} from '../services/api'
import type { Question, QuestionCreate, Tag as TagType } from '../services/api'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'

type EditState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; record: Question }

function parseLines(value?: string): string[] | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  return trimmed
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseComma(value?: string): string[] | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Helper to convert tags to tree
const buildTagTree = (items: TagType[], parentId: number | null = null): DataNode[] => {
  return items
    .filter(item => item.parent_id === parentId)
    .map(item => ({
      key: item.name, // Use name as value for Questions
      value: item.name,
      title: item.name,
      children: buildTagTree(items, item.id),
      isLeaf: !items.some(i => i.parent_id === item.id)
    }))
}

export default function QuestionsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Question[]>([])
  const [tags, setTags] = useState<TagType[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [edit, setEdit] = useState<EditState>({ open: false })
  const [form] = Form.useForm()
  
  // Filters
  const [filters, setFilters] = useState<{
    q_type?: string
    difficulty?: number
    tag?: string
    search?: string
    status?: string
    source_doc?: string
  }>({})

  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  async function refresh(page = pagination.current, pageSize = pagination.pageSize) {
    setLoading(true)
    try {
      const [res, tagItems] = await Promise.all([
        listQuestions({ 
          ...filters, 
          skip: (page - 1) * pageSize,
          limit: pageSize
        }),
        listTags()
      ])
      setData(res.items)
      setPagination(p => ({ ...p, current: page, pageSize, total: res.total }))
      setTags(tagItems)
      setSelectedRowKeys([])
    } catch (e) {
      console.error(e)
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const tagTreeData = useMemo(() => buildTagTree(tags), [tags])

  useEffect(() => {
    refresh(1)
  }, [filters.q_type, filters.difficulty, filters.tag, filters.status, filters.search, filters.source_doc])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Delete key for batch delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRowKeys.length > 0) {
        // Avoid triggering if user is typing in an input
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        
        confirmBatchDelete()
      }
      // Esc key to clear selection
      if (e.key === 'Escape' && selectedRowKeys.length > 0) {
        setSelectedRowKeys([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRowKeys])

  async function handleExport() {
    try {
      const blob = await exportQuestions(filters)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'questions_export.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('导出成功')
    } catch (e) {
      console.error(e)
      message.error('导出失败')
    }
  }

  // Batch Operations
  async function handleBatchDelete() {
    try {
      await batchOperateQuestions({
        ids: selectedRowKeys as number[],
        action: 'delete',
      })
      message.success(`已批量删除 ${selectedRowKeys.length} 个题目`)
      refresh()
    } catch (e) {
      console.error(e)
      message.error('批量删除失败')
    }
  }

  function confirmBatchDelete() {
    if (selectedRowKeys.length === 0) return
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个题目吗？此操作不可恢复。`,
      okType: 'danger',
      onOk: handleBatchDelete
    })
  }

  const [batchDifficultyOpen, setBatchDifficultyOpen] = useState(false)
  const [batchDifficulty, setBatchDifficulty] = useState(3)
  const [batchTagsOpen, setBatchTagsOpen] = useState(false)
  const [batchTags, setBatchTags] = useState<string[]>([])

  const [reviewModal, setReviewModal] = useState<{
    open: boolean
    record?: Question
    action: 'published' | 'disabled'
  }>({ open: false, action: 'published' })
  const [reviewComment, setReviewComment] = useState('')

  async function handleReviewSubmit() {
    if (!reviewModal.record) return
    try {
      await reviewQuestion(reviewModal.record.id, {
        status: reviewModal.action,
        comment: reviewComment,
        reviewer: 'Admin',
      })
      message.success(reviewModal.action === 'published' ? '已审核通过' : '已拒绝驳回')
      setReviewModal({ open: false, action: 'published' })
      setReviewComment('')
      refresh()
    } catch (e) {
      console.error(e)
      message.error('操作失败')
    }
  }

  async function handleBatchDifficulty() {
    if (selectedRowKeys.length === 0) return
    try {
      await batchOperateQuestions({
        ids: selectedRowKeys as number[],
        action: 'update_difficulty',
        value: batchDifficulty,
      })
      message.success('难度已批量更新')
      setBatchDifficultyOpen(false)
      refresh()
    } catch (e) {
      console.error(e)
      message.error('难度更新失败')
    }
  }

  async function handleBatchTags() {
    if (selectedRowKeys.length === 0) return
    if (batchTags.length === 0) {
        message.warning('请选择至少一个标签')
        return
    }
    try {
      await batchOperateQuestions({
        ids: selectedRowKeys as number[],
        action: 'update_tags',
        value: batchTags,
      })
      message.success('标签已批量更新')
      setBatchTagsOpen(false)
      refresh()
    } catch (e) {
      console.error(e)
      message.error('标签更新失败')
    }
  }

  const columns: ColumnsType<Question> = useMemo(
    () => {
      const cols: ColumnsType<Question> = [
      { title: 'ID', dataIndex: 'id', width: 70, sorter: (a, b) => a.id - b.id },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status) => {
          const map: Record<string, { color: string; text: string }> = {
            draft: { color: 'default', text: '草稿' },
            review: { color: 'processing', text: '待审核' },
            published: { color: 'success', text: '已发布' },
            disabled: { color: 'error', text: '已禁用' },
            archived: { color: 'warning', text: '已归档' },
            needs_modification: { color: 'warning', text: '需修改' },
          }
          const cfg = map[status as string] || { color: 'default', text: status }
          return <Badge status={cfg.color as "default" | "processing" | "success" | "error" | "warning"} text={cfg.text} />
        },
      },
      {
        title: '题型',
        dataIndex: 'q_type',
        width: 90,
        filters: [
          { text: '单选', value: 'single' },
          { text: '多选', value: 'multi' },
          { text: '判断', value: 'judge' },
          { text: '简答', value: 'essay' },
        ],
        onFilter: (value, record) => record.q_type === value,
        render: (t: string) => {
            const map: Record<string, string> = {
                single: '单选',
                multi: '多选',
                judge: '判断',
                essay: '简答',
            }
            return map[t] || t
        }
      },
      {
        title: '难度',
        dataIndex: 'difficulty',
        width: 90,
        sorter: (a, b) => a.difficulty - b.difficulty,
        render: (d) => <Tag color={d >= 4 ? 'red' : d >= 3 ? 'orange' : 'green'}>{d}星</Tag>,
      },
      { title: '来源', dataIndex: 'source_doc', width: 150, ellipsis: true },
      {
        title: '题干',
        dataIndex: 'content',
        ellipsis: true,
        render: (text) => <span title={text}>{text}</span>,
      },
      {
        title: '标签',
        dataIndex: 'tags',
        width: 150,
        render: (tags?: string[] | null) => (
          <Space wrap size={4}>
            {(tags ?? []).slice(0, 3).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {(tags?.length ?? 0) > 3 && <Tag>...</Tag>}
          </Space>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 150,
        render: (t: string) => t ? new Date(t).toLocaleString() : '-',
        sorter: (a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 150,
        render: (t: string) => new Date(t).toLocaleString(),
        sorter: (a, b) => a.created_at.localeCompare(b.created_at),
      },
      {
        title: '操作',
        width: 220,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEdit({ open: true, mode: 'edit', record })
                form.setFieldsValue({
                  ...record,
                  optionsText: (record.options ?? []).join('\n'),
                  tagsText: (record.tags ?? []).join(','),
                  knowledgePointsText: (record.knowledge_points ?? []).join(','),
                })
              }}
            >
              编辑
            </Button>
            {record.status === 'review' && (
              <>
                <Button 
                  type="text" 
                  style={{ color: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                   onClick={() => {
                      setReviewModal({ open: true, record, action: 'published' })
                   }}
                >
                  通过
                </Button>
                <Button 
                  type="text" 
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setReviewModal({ open: true, record, action: 'disabled' })}
                >
                  拒绝
                </Button>
              </>
            )}
            <Popconfirm title="确认删除？" onConfirm={async () => {
              await deleteQuestion(record.id)
              message.success('已删除')
              refresh()
            }}>
              <Button type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ]

    return cols
  },
    [form]
  )

  async function onSubmit() {
    const values = await form.validateFields()
    const content = values.content?.trim()
    
    // Check duplicates before creating (Client-side pre-check via API)
    if ((!edit.open || edit.mode === 'create') && content) {
      try {
        const { similar_questions } = await checkDuplicate(content)
        if (similar_questions.length > 0) {
          const confirmed = await new Promise<boolean>((resolve) => {
            Modal.confirm({
              title: '发现相似题目',
              content: (
                <div>
                  <p>系统检测到库中已有 {similar_questions.length} 个相似题目：</p>
                  <ul style={{ maxHeight: 200, overflow: 'auto', paddingLeft: 20 }}>
                    {similar_questions.map((q: { id: number; content: string; score: number }) => (
                      <li key={q.id} style={{ marginBottom: 8 }}>
                        [相似度 {(q.score * 100).toFixed(0)}%] {q.content}
                      </li>
                    ))}
                  </ul>
                  <p style={{ color: 'red', fontWeight: 'bold' }}>注意：后端已启用严格哈希查重，完全重复的内容将无法提交。</p>
                  <p>是否尝试继续添加？</p>
                </div>
              ),
              okText: '尝试添加',
              okType: 'danger',
              cancelText: '取消',
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            })
          })
          if (!confirmed) return
        }
      } catch (e) {
        console.warn('Duplicate check failed', e)
      }
    }

    const payload: QuestionCreate = {
      ...values,
      content,
      answer: values.answer?.trim() || null,
      analysis: values.analysis?.trim() || null,
      source_doc: values.source_doc?.trim() || null,
      chapter_num: values.chapter_num?.trim() || null,
      clause_num: values.clause_num?.trim() || null,
      options: parseLines(values.optionsText),
      tags: parseComma(values.tagsText),
      knowledge_points: parseComma(values.knowledgePointsText),
    }

    if (edit.open && edit.mode === 'edit') {
      try {
        await updateQuestion(edit.record.id, payload)
        message.success('已更新')
        setEdit({ open: false })
        form.resetFields()
        refresh()
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } } }
        const msg = err.response?.data?.detail || '更新失败'
        if (msg.includes('Duplicate question')) {
          message.error('更新失败：题库中已存在完全相同的内容（严格哈希校验）')
        } else {
          message.error(msg)
        }
      }
    } else {
      try {
        await createQuestion(payload)
        message.success('已创建')
        setEdit({ open: false })
        form.resetFields()
        refresh()
      } catch (e: unknown) {
        // Handle strict duplicate error
        const err = e as { response?: { data?: { detail?: string } } }
        const msg = err.response?.data?.detail || '创建失败'
        if (msg.includes('Duplicate question')) {
          message.error('创建失败：题库中已存在完全相同的内容（严格哈希校验）')
        } else {
          message.error(msg)
        }
      }
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Status Tabs */}
      <Tabs 
        activeKey={filters.status || 'all'}
        onChange={key => {
            const status = key === 'all' ? undefined : key
            setFilters(p => ({ ...p, status }))
        }}
        items={[
            { label: '全部', key: 'all' },
            { label: '待审核', key: 'review' },
            { label: '已发布', key: 'published' },
            { label: '需修改', key: 'needs_modification' },
            { label: '草稿', key: 'draft' },
            { label: '已禁用', key: 'disabled' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px 24px' }}>
        <Form layout="inline">
          <Form.Item label="搜索">
            <Input
              placeholder="题干/ID"
              allowClear
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
              onPressEnter={() => refresh(1)}
            />
          </Form.Item>
          <Form.Item label="来源文档">
            <Input
              placeholder="文档名称"
              allowClear
              value={filters.source_doc}
              onChange={(e) => setFilters((p) => ({ ...p, source_doc: e.target.value || undefined }))}
              onPressEnter={() => refresh(1)}
            />
          </Form.Item>
          <Form.Item label="标签">
             <TreeSelect
                treeData={tagTreeData}
                allowClear
                placeholder="选择标签"
                style={{ width: 150 }}
                value={filters.tag}
                onChange={(v) => setFilters((p) => ({ ...p, tag: v }))}
                treeDefaultExpandAll
             />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 100 }}
              value={filters.status}
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'review', label: '待审核' },
                { value: 'published', label: '已发布' },
                { value: 'disabled', label: '已禁用' },
              ]}
              onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={() => refresh(1)} icon={<SearchOutlined />}>查询</Button>
              <Button onClick={() => setFilters({})} icon={<ReloadOutlined />}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Action Bar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEdit({ open: true, mode: 'create' })
              form.resetFields()
              form.setFieldsValue({ difficulty: 3, score: 2, q_type: 'single', status: 'draft' })
            }}
          >
            新增题目
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出结果</Button>
          {selectedRowKeys.length > 0 && (
            <>
              <Button onClick={() => setBatchDifficultyOpen(true)}>批量改难度</Button>
              <Button onClick={() => setBatchTagsOpen(true)}>批量改标签</Button>
              <Button danger onClick={confirmBatchDelete}>批量删除</Button>
            </>
          )}
        </Space>
        <Space>
          <span>已选 {selectedRowKeys.length} 项</span>
        </Space>
      </div>

      <Table<Question>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={(p) => refresh(p.current, p.pageSize)}
        scroll={{ x: 1200 }}
      />

      <Modal
        open={edit.open}
        title={edit.open && edit.mode === 'edit' ? '编辑题目' : '新增题目'}
        width={800}
        onCancel={() => setEdit({ open: false })}
        onOk={onSubmit}
        okText="保存"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Tabs defaultActiveKey="1" items={[
            {
              key: '1',
              label: '基本信息',
              children: (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="q_type" label="题型" rules={[{ required: true }]}>
                        <Select
                          options={[
                            { value: 'single', label: '单选' },
                            { value: 'multi', label: '多选' },
                            { value: 'judge', label: '判断' },
                            { value: 'essay', label: '简答' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                        <Select
                          options={[
                            { value: 'draft', label: '草稿' },
                            { value: 'review', label: '待审核' },
                            { value: 'published', label: '已发布' },
                            { value: 'disabled', label: '已禁用' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="content" label="题干内容" rules={[{ required: true }]}>
                    <Input.TextArea rows={4} showCount />
                  </Form.Item>
                  <Form.Item name="optionsText" label="选项 (仅单选/多选，每行一个)">
                    <Input.TextArea rows={4} placeholder="A. 选项一&#10;B. 选项二" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="answer" label="参考答案">
                        <Input placeholder="如：A 或 对" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                       <Form.Item name="difficulty" label="难度 (1-5)">
                        <InputNumber min={1} max={5} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="score" label="默认分值">
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="analysis" label="解析">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              ),
            },
            {
              key: '2',
              label: '来源与分类',
              children: (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="source_doc" label="来源文档">
                        <Input placeholder="例如：xx安全规范" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="page_num" label="页码">
                        <InputNumber style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="chapter_num" label="章节号">
                        <Input placeholder="例如：3.1.2" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="clause_num" label="条款号">
                        <Input placeholder="例如：5.4.1" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="tagsText" label="标签 (逗号分隔，或使用下方选择)">
                    <Input placeholder="安全, 消防, 基础" style={{ marginBottom: 8 }} />
                    <TreeSelect
                      treeData={tagTreeData}
                      treeCheckable
                      allowClear
                      placeholder="从标签树选择"
                      onChange={(values: string[]) => {
                         // Merge with input text
                         const currentText = form.getFieldValue('tagsText') || ''
                         const currentTags = parseComma(currentText) || []
                         // This is tricky because TreeSelect is multi-value but input is text
                         // Let's just append new ones or replace?
                         // Better: Sync TreeSelect with a hidden field or just use TreeSelect primarily?
                         // For compatibility, let's just set the text field
                         const newTags = Array.from(new Set([...currentTags, ...values]))
                         form.setFieldsValue({ tagsText: newTags.join(',') })
                      }}
                    />
                  </Form.Item>
                  <Form.Item name="knowledgePointsText" label="知识点 (逗号分隔)">
                    <Input placeholder="灭火器使用, 逃生路线" />
                  </Form.Item>
                </>
              ),
            },
          ]} />
        </Form>
      </Modal>

      <Modal
        open={reviewModal.open}
        title={reviewModal.action === 'published' ? '审核通过' : '拒绝/驳回'}
        onCancel={() => setReviewModal({ ...reviewModal, open: false })}
        onOk={handleReviewSubmit}
        okText="确认提交"
        okType={reviewModal.action === 'published' ? 'primary' : 'danger'}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviewModal.action === 'disabled' && (
            <div>
              <div style={{ marginBottom: 8, color: 'red' }}>请输入拒绝/驳回理由：</div>
              <Input.TextArea
                rows={3}
                placeholder="例如：题目内容不准确，或格式错误..."
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
              />
            </div>
          )}
          {reviewModal.action === 'published' && (
             <p>确认将该题目发布到题库？</p>
          )}
        </div>
      </Modal>

      <Modal
        open={batchDifficultyOpen}
        title="批量修改难度"
        onCancel={() => setBatchDifficultyOpen(false)}
        onOk={handleBatchDifficulty}
        destroyOnClose
        width={300}
      >
        <div style={{ padding: 20, textAlign: 'center' }}>
          <span>新难度等级：</span>
          <InputNumber 
            min={1} 
            max={5} 
            value={batchDifficulty} 
            onChange={(v) => setBatchDifficulty(v || 1)} 
          />
        </div>
      </Modal>
      <Modal
        open={batchTagsOpen}
        title="批量修改标签"
        onCancel={() => setBatchTagsOpen(false)}
        onOk={handleBatchTags}
        destroyOnClose
        width={400}
      >
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 8 }}>选择新标签（将覆盖原有标签）：</div>
          <TreeSelect
            treeData={tagTreeData}
            treeCheckable
            allowClear
            style={{ width: '100%' }}
            placeholder="从标签树选择"
            value={batchTags}
            onChange={setBatchTags}
            treeDefaultExpandAll
          />
        </div>
      </Modal>
    </div>
  )
}
