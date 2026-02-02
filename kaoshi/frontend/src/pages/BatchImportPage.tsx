import { useState } from 'react'
import {
  Button,
  Card,
  Upload,
  Table,
  Tag,
  message,
  Steps,
  Alert,
  Space,
  Typography,
} from 'antd'
import {
  InboxOutlined,
  UploadOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { parseImportFile, batchCreateQuestions } from '../services/api'
import type { ParsedItem } from '../services/api'

const { Dragger } = Upload
const { Title, Text } = Typography

export default function BatchImportPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedItem[]>([])

  // Step 1: Handle File Upload
  async function handleFileUpload(file: File) {
    setLoading(true)
    try {
      const res = await parseImportFile(file)
      setParsedData(res.items)
      setCurrentStep(1)
      message.success(`成功解析 ${res.total} 条数据`)
    } catch (e) {
      console.error(e)
      message.error('文件解析失败，请检查文件格式')
    } finally {
      setLoading(false)
    }
    return false // Prevent auto upload
  }

  // Step 2: Review & Edit
  const validCount = parsedData.filter(i => i.status === 'valid').length
  const duplicateCount = parsedData.filter(i => i.status === 'duplicate').length
  const invalidCount = parsedData.filter(i => ['invalid', 'error'].includes(i.status)).length

  const columns: ColumnsType<ParsedItem> = [
    {
      title: '行号',
      dataIndex: 'row_index',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      filters: [
        { text: '有效', value: 'valid' },
        { text: '重复', value: 'duplicate' },
        { text: '无效', value: 'invalid' },
        { text: '错误', value: 'error' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const map = {
          valid: { color: 'success', icon: <CheckCircleOutlined />, text: '有效' },
          duplicate: { color: 'warning', icon: <ExclamationCircleOutlined />, text: '重复' },
          invalid: { color: 'error', icon: <CloseCircleOutlined />, text: '无效' },
          error: { color: 'error', icon: <CloseCircleOutlined />, text: '错误' },
        }
        const cfg = map[status as keyof typeof map]
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.text}</Tag>
      }
    },
    {
      title: '题干',
      dataIndex: ['data', 'content'],
      ellipsis: true,
      render: (text, record) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Text ellipsis>{text}</Text>
          {record.errors.length > 0 && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {record.errors.join(', ')}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '题型',
      dataIndex: ['data', 'q_type'],
      width: 100,
      render: (t) => {
        const map: Record<string, string> = { single: '单选', multi: '多选', judge: '判断', essay: '简答' }
        return map[t] || t
      }
    },
    {
      title: '难度',
      dataIndex: ['data', 'difficulty'],
      width: 80,
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => {
            setParsedData(prev => prev.filter(p => p.row_index !== record.row_index))
          }}
        />
      )
    }
  ]

  // Step 3: Submit
  async function handleImport() {
    const questionsToImport = parsedData
      .filter(i => i.status === 'valid')
      .map(i => i.data)
    
    if (questionsToImport.length === 0) {
      message.warning('没有有效的题目可导入')
      return
    }

    setLoading(true)
    try {
      await batchCreateQuestions({ questions: questionsToImport })
      message.success(`成功导入 ${questionsToImport.length} 条题目`)
      setCurrentStep(2)
    } catch (e) {
      console.error(e)
      message.error('导入失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="批量入库模块">
        <Steps
          current={currentStep}
          items={[
            { title: '上传文件' },
            { title: '数据校验与预览' },
            { title: '完成' },
          ]}
          style={{ marginBottom: 40, maxWidth: 800, margin: '0 auto 40px' }}
        />

        {currentStep === 0 && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 0' }}>
            <Dragger
              accept=".csv,.xlsx,.xls"
              beforeUpload={handleFileUpload}
              showUploadList={false}
              disabled={loading}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">
                支持 CSV, Excel 格式。请确保包含：题干、题型、难度、选项、答案等列。
              </p>
            </Dragger>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Button href="/template.xlsx" type="link" icon={<UploadOutlined />}>
                下载导入模板
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Alert
              message={`解析完成：共 ${parsedData.length} 条数据`}
              description={
                <Space>
                  <Tag color="success">有效: {validCount}</Tag>
                  <Tag color="warning">重复: {duplicateCount}</Tag>
                  <Tag color="error">无效/错误: {invalidCount}</Tag>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              action={
                <Space>
                  <Button onClick={() => setCurrentStep(0)}>重新上传</Button>
                  <Button 
                    type="primary" 
                    onClick={handleImport} 
                    loading={loading}
                    disabled={validCount === 0}
                  >
                    导入有效数据 ({validCount})
                  </Button>
                </Space>
              }
            />
            
            <Table
              dataSource={parsedData}
              columns={columns}
              rowKey="row_index"
              pagination={{ pageSize: 50 }}
              scroll={{ y: 600 }}
              size="small"
            />
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 20 }} />
            <Title level={3}>导入完成</Title>
            <p>已成功将题目导入题库。</p>
            <Space style={{ marginTop: 20 }}>
              <Button type="primary" onClick={() => setCurrentStep(0)}>继续导入</Button>
              <Button href="/questions">前往题库查看</Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  )
}
