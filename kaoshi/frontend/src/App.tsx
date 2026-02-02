import { Layout, Menu, Typography } from 'antd'
import { Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom'
import QuestionsPage from './pages/QuestionsPage'
import RulesPage from './pages/RulesPage'
import PapersPage from './pages/PapersPage'
import AIPage from './pages/AIPage'
import BatchImportPage from './pages/BatchImportPage'
import {
  FileTextOutlined,
  SettingOutlined,
  DatabaseOutlined,
  RobotOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons'

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider collapsible>
        <div style={{ padding: 16 }}>
          <Typography.Title level={5} style={{ color: '#fff', margin: 0 }}>
            Smart Exam
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[
            { key: '/papers', icon: <FileTextOutlined />, label: '组卷与导出' },
            { key: '/rules', icon: <SettingOutlined />, label: '规则配置' },
            { key: '/questions', icon: <DatabaseOutlined />, label: '题库管理' },
            { key: '/batch-import', icon: <CloudUploadOutlined />, label: '批量入库' },
            { key: '/ai', icon: <RobotOutlined />, label: 'AI 智能出题' },
          ]}
          onClick={(e) => navigate(e.key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ background: '#fff' }}>
          <Typography.Text style={{ fontSize: 16 }}>试卷导出模式（MVP）</Typography.Text>
        </Layout.Header>
        <Layout.Content style={{ padding: 16 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/papers" replace />} />
            <Route path="/papers" element={<PapersPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/batch-import" element={<BatchImportPage />} />
            <Route path="/ai" element={<AIPage />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default App
