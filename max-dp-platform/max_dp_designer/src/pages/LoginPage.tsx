import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Alert, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import type { LoginRequest } from '@/services/api';

const { Title, Text } = Typography;

interface LocationState {
  redirect?: string;
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();

  const state = location.state as LocationState;
  const redirectPath = state?.redirect || '/workspaces';

  useEffect(() => {
    // 이미 인증된 경우 대시보드로 리디렉션
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  useEffect(() => {
    // 에러 초기화
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSubmit = async (values: LoginRequest) => {
    const success = await login(values);
    
    if (success) {
      navigate(redirectPath, { replace: true });
    }
  };

  const handleRegisterClick = () => {
    // MAX Platform 회원가입 페이지로 이동
    window.location.href = 'http://localhost:3000/register';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: '12px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: 8 }}>
            MAX DP Designer
          </Title>
          <Text type="secondary">
            데이터 파이프라인 시각적 설계 도구
          </Text>
        </div>

        {error && (
          <Alert
            message="로그인 실패"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          requiredMark={false}
          size="large"
        >
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: '이메일을 입력해주세요!' },
              { type: 'email', message: '올바른 이메일 형식을 입력해주세요!' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="이메일을 입력하세요"
              autoComplete="email"
              disabled={isLoading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="비밀번호"
            rules={[
              { required: true, message: '비밀번호를 입력해주세요!' },
              { min: 6, message: '비밀번호는 최소 6자 이상이어야 합니다.' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              disabled={isLoading}
              onPressEnter={() => form.submit()}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{ height: 48 }}
            >
              로그인
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size="small">
            <Text type="secondary">
              아직 계정이 없으신가요?
            </Text>
            <Button
              type="link"
              icon={<LinkOutlined />}
              onClick={handleRegisterClick}
              style={{ padding: 0, height: 'auto' }}
            >
              MAX Platform에서 회원가입하기
            </Button>
          </Space>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: '#f0f2f5',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            이 도구는 MAX Platform 계정이 필요합니다.
            <br />
            MAX Platform에서 회원가입 후 이용하세요.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage; 