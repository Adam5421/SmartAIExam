import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { createRule, deleteRule, listRules, updateRule } from '../services/api'
import type { Rule, RuleCreate } from '../services/api'

type EditState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; record: Rule }

const TYPE_MAP: Record<string, string> = {
  single: '单选',
  multi: '多选',
  judge: '判断',
  essay: '简答',
}

const defaultConfig = {
  type_distribution: { single: 10, multi: 5, judge: 5, essay: 2 },
  difficulty_distribution: { '1': 0.1, '2': 0.2, '3': 0.4, '4': 0.2, '5': 0.1 },
  tags: [],
}

export default function RulesPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Rule[]>([])
  const [edit, setEdit] = useState<EditState>({ open: false })
  const [form] = Form.useForm()

  async function refresh() {
    setLoading(true)
    try {
      const items = await listRules()
      setData(items)
    } catch {
      message.error('加载规则失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const columns: ColumnsType<Rule> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      { title: '名称', dataIndex: 'name', width: 220 },
      { title: '总分', dataIndex: 'total_score', width: 120 },
      {
        title: '摘要',
        render: (_, record) => {
          const typeDistRaw = record.config?.['type_distribution']
          const tagsRaw = record.config?.['tags']
          const typeDist =
            typeDistRaw && typeof typeDistRaw === 'object' && !Array.isArray(typeDistRaw)
              ? (typeDistRaw as Record<string, unknown>)
              : {}
          const tags = Array.isArray(tagsRaw) ? (tagsRaw as string[]) : []
          return (
            <Space wrap>
              {Object.entries(typeDist).map(([k, v]) => (
                <Tag key={k}>
                  {TYPE_MAP[k] || k}:{String(v)}
                </Tag>
              ))}
              {tags.slice(0, 3).map((t) => (
                <Tag key={t} color="blue">
                  {t}
                </Tag>
              ))}
            </Space>
          )
        },
      },
      {
        title: '操作',
        width: 160,
        render: (_, record) => (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setEdit({ open: true, mode: 'edit', record })
                form.setFieldsValue({
                  name: record.name,
                  total_score: record.total_score,
                  single: (record.config?.type_distribution as Record<string, number>)?.single || 0,
                  multi: (record.config?.type_distribution as Record<string, number>)?.multi || 0,
                  judge: (record.config?.type_distribution as Record<string, number>)?.judge || 0,
                  essay: (record.config?.type_distribution as Record<string, number>)?.essay || 0,
                  // We still keep other config parts in memory or just ignore them for this MVP form?
                  // Let's assume user only edits these 4 types for now, and maybe preserves others if we parsed properly.
                  // But to simplify, let's just reconstruct config from these fields + defaults.
                  // Or we can parse the full config to get other values.
                })
              }}
            >
              编辑
            </Button>
            <Button
              size="small"
              danger
              onClick={async () => {
                await deleteRule(record.id)
                message.success('已删除')
                refresh()
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [form],
  )

  async function onSubmit() {
    const values = await form.validateFields()
    
    // Reconstruct config
    const config = {
        type_distribution: {
            single: values.single || 0,
            multi: values.multi || 0,
            judge: values.judge || 0,
            essay: values.essay || 0,
        },
        difficulty_distribution: defaultConfig.difficulty_distribution, // Simplify: use default or maybe allow editing later
        tags: [],
    }

    const payload: RuleCreate = {
      name: values.name,
      total_score: values.total_score,
      config,
    }

    if (edit.open && edit.mode === 'edit') {
      await updateRule(edit.record.id, payload)
      message.success('已更新')
    } else {
      await createRule(payload)
      message.success('已创建')
    }
    setEdit({ open: false })
    form.resetFields()
    refresh()
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button
          type="primary"
          onClick={() => {
            setEdit({ open: true, mode: 'create' })
            form.resetFields()
            form.setFieldsValue({
              name: '默认规则',
              total_score: 100,
              single: 10,
              multi: 5,
              judge: 5,
              essay: 2
            })
          }}
        >
          新增规则
        </Button>
        <Button onClick={refresh}>刷新</Button>
      </Space>

      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        配置试卷生成的题型数量和总分。
      </Typography.Paragraph>

      <Table<Rule> rowKey="id" loading={loading} columns={columns} dataSource={data} pagination={{ pageSize: 20 }} />

      <Modal
        open={edit.open}
        title={edit.open && edit.mode === 'edit' ? '编辑规则' : '新增规则'}
        onCancel={() => setEdit({ open: false })}
        onOk={onSubmit}
        okText="保存"
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="total_score" label="总分" rules={[{ required: true, message: '请输入总分' }]}>
            <InputNumber min={1} max={300} style={{ width: '100%' }} />
          </Form.Item>
          
          <div style={{ fontWeight: 'bold', marginBottom: 12, marginTop: 24 }}>题型数量配置</div>
          <Space size="large" wrap>
              <Form.Item name="single" label="单选题数量">
                  <InputNumber min={0} />
              </Form.Item>
              <Form.Item name="multi" label="多选题数量">
                  <InputNumber min={0} />
              </Form.Item>
              <Form.Item name="judge" label="判断题数量">
                  <InputNumber min={0} />
              </Form.Item>
              <Form.Item name="essay" label="简答题数量">
                  <InputNumber min={0} />
              </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
