import { useState } from 'react'
import { Card, Input, InputNumber, Button, Tag, Spin, message, Row, Col, Select, Upload, Form, Tabs, Space } from 'antd'
import { generateAIQuestions, createQuestion, parseFile, batchCreateQuestions } from '../services/api'
import type { AIGeneratedQuestion, QuestionCreate } from '../services/api'
import { RobotOutlined, SaveOutlined, UploadOutlined, FileTextOutlined, DeleteOutlined, ImportOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'

const { TextArea } = Input
const { Option } = Select

const TYPE_MAP: Record<string, string> = {
  single: '单选',
  multi: '多选',
  judge: '判断',
  essay: '简答',
}

export default function AIPage() {
  const [activeTab, setActiveTab] = useState('text')
  const [text, setText] = useState('')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  
  // Configs
  const [difficulty, setDifficulty] = useState(1)
  const [singleCount, setSingleCount] = useState(3)
  const [multiCount, setMultiCount] = useState(0)
  const [judgeCount, setJudgeCount] = useState(0)
  const [essayCount, setEssayCount] = useState(0)

  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<AIGeneratedQuestion[]>([])

  const handleFileUpload = async (file: File) => {
    setParsing(true)
    try {
      const res = await parseFile(file)
      setText(res.text)
      message.success('文件解析成功')
      setActiveTab('text') // Switch to text view to show parsed content
    } catch (e) {
      console.error(e)
      message.error('文件解析失败')
    } finally {
      setParsing(false)
    }
    return false // Prevent auto upload
  }

  const handleGenerate = async () => {
    if (!text.trim()) {
      message.warning('请输入或上传文本素材')
      return
    }
    const total = singleCount + multiCount + judgeCount + essayCount
    if (total === 0) {
      message.warning('请至少配置一种题型的数量')
      return
    }

    setLoading(true)
    try {
      const data = await generateAIQuestions({
        text,
        difficulty,
        single_choice_count: singleCount,
        multi_choice_count: multiCount,
        judge_count: judgeCount,
        essay_count: essayCount,
      })
      setGeneratedQuestions(data)
      message.success(`生成成功，共 ${data.length} 道题目`)
    } catch (e) {
      console.error(e)
      message.error('生成失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (q: AIGeneratedQuestion) => {
    try {
      await createQuestion({
        content: q.content,
        q_type: q.q_type as 'single' | 'multi' | 'judge' | 'essay',
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        difficulty: q.difficulty,
        tags: q.tags,
        score: 2.0,
        status: 'review' // Default to review for AI generated
      })
      message.success('已保存到题库')
    } catch (e) {
      console.error(e)
      message.error('保存失败')
    }
  }

  const handleBatchSave = async () => {
    if (generatedQuestions.length === 0) return
    
    // Transform to QuestionCreate objects
    const questionsToCreate: QuestionCreate[] = generatedQuestions.map(q => ({
        content: q.content,
        q_type: q.q_type as QuestionCreate['q_type'],
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        difficulty: q.difficulty,
        tags: q.tags,
        score: 2.0,
        status: 'review' // Default to review for approval workflow
    }))

    try {
        const results = await batchCreateQuestions({ questions: questionsToCreate })
        message.success(`批量入库成功，已创建 ${results.length} 道题目，进入待审核状态`)
        // Clear generated questions or keep them? Maybe clear to avoid duplicate re-save
        setGeneratedQuestions([])
    } catch (e: unknown) {
        console.error(e)
        message.error('批量入库失败')
    }
  }

  const handleRemove = (index: number) => {
    const newQuestions = [...generatedQuestions]
    newQuestions.splice(index, 1)
    setGeneratedQuestions(newQuestions)
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        {/* Left: Input & Config */}
        <Col xs={24} lg={10}>
          <Card title="1. 素材与配置" style={{ marginBottom: 24 }}>
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              items={[
                {
                  key: 'text',
                  label: '文本输入',
                  children: (
                    <TextArea
                      rows={10}
                      placeholder="在此粘贴知识点文本，或通过右侧上传文件自动解析..."
                      value={text}
                      onChange={e => setText(e.target.value)}
                      style={{ resize: 'none' }}
                    />
                  )
                },
                {
                  key: 'file',
                  label: '文件上传',
                  children: (
                    <div style={{ padding: 20, textAlign: 'center', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
                      <p style={{ color: '#666', marginBottom: 16 }}>支持 Word (.docx), PDF (.pdf), Markdown (.md)</p>
                      <Upload 
                        beforeUpload={handleFileUpload} 
                        fileList={fileList}
                        onChange={({ fileList }) => setFileList(fileList)}
                        maxCount={1}
                      >
                        <Button icon={<UploadOutlined />} loading={parsing}>点击上传并解析</Button>
                      </Upload>
                    </div>
                  )
                }
              ]}
            />
            
            <div style={{ marginTop: 24 }}>
              <div style={{ marginBottom: 12, fontWeight: 'bold' }}>难度与题型配置</div>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="难度系数">
                    <Select value={difficulty} onChange={setDifficulty} style={{ width: '100%' }}>
                      <Option value={1}>1 - 入门</Option>
                      <Option value={2}>2 - 简单</Option>
                      <Option value={3}>3 - 中等</Option>
                      <Option value={4}>4 - 困难</Option>
                      <Option value={5}>5 - 专家</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="单选题数量">
                    <InputNumber min={0} value={singleCount} onChange={v => setSingleCount(v || 0)} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="多选题数量">
                    <InputNumber min={0} value={multiCount} onChange={v => setMultiCount(v || 0)} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="判断题数量">
                    <InputNumber min={0} value={judgeCount} onChange={v => setJudgeCount(v || 0)} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="简答题数量">
                    <InputNumber min={0} value={essayCount} onChange={v => setEssayCount(v || 0)} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={handleGenerate}
                loading={loading}
                block
                size="large"
                style={{ marginTop: 16 }}
              >
                开始智能生成
              </Button>
            </div>
          </Card>
        </Col>

        {/* Right: Preview & Edit */}
        <Col xs={24} lg={14}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>2. 结果预览与编辑</span>
                {generatedQuestions.length > 0 && (
                  <Space>
                    <Tag color="blue">共 {generatedQuestions.length} 题</Tag>
                    <Button 
                        type="primary" 
                        size="small" 
                        icon={<ImportOutlined />}
                        onClick={handleBatchSave}
                    >
                        批量入库
                    </Button>
                  </Space>
                )}
              </div>
            }
            bodyStyle={{ padding: 16, background: '#f0f2f5', minHeight: 600, maxHeight: '80vh', overflowY: 'auto' }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 80 }}>
                <Spin size="large" tip="AI 正在深度思考中..." />
              </div>
            ) : generatedQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 100 }}>
                <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>左侧配置完成后，点击生成即可预览题目</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {generatedQuestions.map((item, index) => (
                   <Card
                     key={index}
                     size="small"
                     title={`#${index + 1} [${TYPE_MAP[item.q_type] || item.q_type}]`}
                     extra={
                       <Space>
                         <Button 
                           type="text" 
                           danger 
                           icon={<DeleteOutlined />} 
                           onClick={() => handleRemove(index)}
                         />
                         <Button
                           type="primary"
                           size="small"
                           icon={<SaveOutlined />}
                           onClick={() => handleSave(item)}
                         >
                           保存入库
                         </Button>
                       </Space>
                     }
                   >
                     <Input.TextArea 
                       value={item.content} 
                       onChange={(e) => {
                         const newQ = [...generatedQuestions]
                         newQ[index].content = e.target.value
                         setGeneratedQuestions(newQ)
                       }}
                       autoSize={{ minRows: 2 }}
                       style={{ marginBottom: 12, fontWeight: 'bold' }}
                     />
                     
                     {item.options && (
                       <div style={{ marginBottom: 12, background: '#fff', padding: 8, borderRadius: 4 }}>
                         {item.options.map((opt, i) => (
                           <Input 
                             key={i} 
                             value={opt} 
                             onChange={(e) => {
                               const newQ = [...generatedQuestions]
                               if (newQ[index].options) {
                                 newQ[index].options![i] = e.target.value
                               }
                               setGeneratedQuestions(newQ)
                             }}
                             size="small" 
                             style={{ marginBottom: 4 }} 
                             prefix={<span style={{ color: '#999', marginRight: 4 }}>{String.fromCharCode(65 + i)}.</span>}
                           />
                         ))}
                       </div>
                     )}
                     
                     <div style={{ background: '#f9f9f9', padding: 8, borderRadius: 4 }}>
                       <Row gutter={8}>
                         <Col span={12}>
                           <span style={{ color: '#666', fontSize: 12 }}>参考答案：</span>
                           <Input 
                             value={item.answer} 
                             onChange={(e) => {
                               const newQ = [...generatedQuestions]
                               newQ[index].answer = e.target.value
                               setGeneratedQuestions(newQ)
                             }}
                             size="small" 
                           />
                         </Col>
                         <Col span={24} style={{ marginTop: 8 }}>
                           <span style={{ color: '#666', fontSize: 12 }}>解析：</span>
                           <Input.TextArea
                             value={item.analysis} 
                             onChange={(e) => {
                               const newQ = [...generatedQuestions]
                               newQ[index].analysis = e.target.value
                               setGeneratedQuestions(newQ)
                             }}
                             autoSize 
                             size="small" 
                           />
                         </Col>
                       </Row>
                     </div>
                   </Card>
                 ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
