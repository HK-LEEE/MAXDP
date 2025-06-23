import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Space, Divider, Card, Typography, message, Collapse } from 'antd';
import { ApiOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import BaseNodeConfig from '../BaseNodeConfig';
import { NodeConfigProps } from '../types';
import { useFormValidation } from '../validation/hooks';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

interface ApiQueryConfigData {
  apiUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  parameters: Record<string, string>;
  body?: string;
  responseType: 'json' | 'text' | 'xml';
  timeout: number;
  retryCount: number;
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
}

const ApiQueryConfig: React.FC<NodeConfigProps> = ({
  nodeId,
  config,
  onConfigChange,
  onValidate
}) => {
  const [form] = Form.useForm<ApiQueryConfigData>();
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const validationRules = {
    apiUrl: [
      { required: true, message: 'API URL을 입력하세요' },
      { type: 'url' as const, message: '유효한 URL을 입력하세요' }
    ],
    method: [
      { required: true, message: 'HTTP 메서드를 선택하세요' }
    ],
    timeout: [
      { required: true, message: '타임아웃을 설정하세요' },
      { type: 'number' as const, min: 1000, max: 60000, message: '1초-60초 사이로 설정하세요' }
    ]
  };

  const { 
    fieldErrors: errors, 
    isValid,
    setFieldError,
    clearAll: clearAllErrors 
  } = useFormValidation();

  const validateField = (fieldName: string, value: any) => {
    const rules = validationRules[fieldName as keyof typeof validationRules];
    if (!rules) return;

    for (const rule of rules) {
      if (rule.required && (!value || value === '')) {
        setFieldError(fieldName, rule.message);
        return;
      }
      if (rule.type === 'url' && value && !isValidUrl(value)) {
        setFieldError(fieldName, rule.message);
        return;
      }
      if (rule.type === 'number' && value) {
        const num = Number(value);
        if (isNaN(num) || (rule.min && num < rule.min) || (rule.max && num > rule.max)) {
          setFieldError(fieldName, rule.message);
          return;
        }
      }
    }
    setFieldError(fieldName, null);
  };

  const validateAll = () => {
    const values = form.getFieldsValue();
    Object.keys(validationRules).forEach(fieldName => {
      validateField(fieldName, values[fieldName]);
    });
    onValidate?.(isValid, errors);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config);
    }
  }, [config, form]);

  const handleFormChange = () => {
    const values = form.getFieldsValue();
    onConfigChange(values);
    validateAll();
  };

  const testApiConnection = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      
      setTesting(true);
      
      // 실제 API 테스트 로직 (여기서는 시뮬레이션)
      const testData = {
        url: values.apiUrl,
        method: values.method,
        headers: values.headers || {},
        timeout: values.timeout || 30000
      };

      // 시뮬레이션된 응답
      setTimeout(() => {
        setTestResult({
          status: 200,
          statusText: 'OK',
          data: {
            message: 'API 연결 테스트 성공',
            timestamp: new Date().toISOString(),
            sampleData: [
              { id: 1, name: 'Sample Record 1', value: 100 },
              { id: 2, name: 'Sample Record 2', value: 200 }
            ]
          },
          headers: {
            'content-type': 'application/json',
            'x-response-time': '150ms'
          }
        });
        setTesting(false);
        message.success('API 연결 테스트가 성공했습니다.');
      }, 1500);

    } catch (error) {
      setTesting(false);
      message.error('API 연결 테스트에 실패했습니다.');
    }
  };

  const addHeader = () => {
    const headers = form.getFieldValue('headers') || {};
    const newKey = `header_${Object.keys(headers).length + 1}`;
    form.setFieldValue('headers', { ...headers, [newKey]: '' });
    handleFormChange();
  };

  const addParameter = () => {
    const parameters = form.getFieldValue('parameters') || {};
    const newKey = `param_${Object.keys(parameters).length + 1}`;
    form.setFieldValue('parameters', { ...parameters, [newKey]: '' });
    handleFormChange();
  };

  return (
    <BaseNodeConfig
      title="API Query 설정"
      description="외부 API에서 데이터를 가져오는 설정입니다"
      icon={<ApiOutlined />}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        autoComplete="off"
      >
        <Divider orientation="left">기본 설정</Divider>
        
        <Form.Item
          label="API URL"
          name="apiUrl"
          rules={validationRules.apiUrl}
          validateStatus={errors.apiUrl ? 'error' : ''}
          help={errors.apiUrl}
        >
          <Input 
            placeholder="https://api.example.com/data"
            prefix={<ApiOutlined />}
          />
        </Form.Item>

        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            label="HTTP 메서드"
            name="method"
            rules={validationRules.method}
            validateStatus={errors.method ? 'error' : ''}
            help={errors.method}
            style={{ flex: 1 }}
          >
            <Select placeholder="메서드 선택">
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="응답 타입"
            name="responseType"
            initialValue="json"
            style={{ flex: 1 }}
          >
            <Select>
              <Option value="json">JSON</Option>
              <Option value="text">Text</Option>
              <Option value="xml">XML</Option>
            </Select>
          </Form.Item>
        </Space>

        <Collapse ghost>
          <Panel header="인증 설정" key="auth">
            <Form.Item label="인증 타입" name={['authentication', 'type']} initialValue="none">
              <Select>
                <Option value="none">없음</Option>
                <Option value="bearer">Bearer Token</Option>
                <Option value="basic">Basic Auth</Option>
                <Option value="apikey">API Key</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.authentication?.type !== currentValues.authentication?.type
              }
            >
              {({ getFieldValue }) => {
                const authType = getFieldValue(['authentication', 'type']);
                
                if (authType === 'bearer') {
                  return (
                    <Form.Item label="Bearer Token" name={['authentication', 'token']}>
                      <Input.Password placeholder="토큰 입력" />
                    </Form.Item>
                  );
                }
                
                if (authType === 'basic') {
                  return (
                    <Space style={{ width: '100%' }}>
                      <Form.Item label="사용자명" name={['authentication', 'username']}>
                        <Input placeholder="사용자명" />
                      </Form.Item>
                      <Form.Item label="비밀번호" name={['authentication', 'password']}>
                        <Input.Password placeholder="비밀번호" />
                      </Form.Item>
                    </Space>
                  );
                }
                
                if (authType === 'apikey') {
                  return (
                    <Space style={{ width: '100%' }}>
                      <Form.Item label="헤더명" name={['authentication', 'headerName']}>
                        <Input placeholder="X-API-Key" />
                      </Form.Item>
                      <Form.Item label="API Key" name={['authentication', 'apiKey']}>
                        <Input.Password placeholder="API 키" />
                      </Form.Item>
                    </Space>
                  );
                }
                
                return null;
              }}
            </Form.Item>
          </Panel>

          <Panel header="요청 헤더" key="headers">
            <Form.Item name="headers">
              <div>
                {/* 동적 헤더 입력 필드들 */}
                <Button type="dashed" onClick={addHeader} style={{ width: '100%', marginBottom: 16 }}>
                  + 헤더 추가
                </Button>
              </div>
            </Form.Item>
          </Panel>

          <Panel header="요청 파라미터" key="parameters">
            <Form.Item name="parameters">
              <div>
                {/* 동적 파라미터 입력 필드들 */}
                <Button type="dashed" onClick={addParameter} style={{ width: '100%', marginBottom: 16 }}>
                  + 파라미터 추가
                </Button>
              </div>
            </Form.Item>
          </Panel>

          <Panel header="고급 설정" key="advanced">
            <Space style={{ width: '100%' }}>
              <Form.Item
                label="타임아웃 (ms)"
                name="timeout"
                initialValue={30000}
                rules={validationRules.timeout}
                validateStatus={errors.timeout ? 'error' : ''}
                help={errors.timeout}
              >
                <Input type="number" placeholder="30000" />
              </Form.Item>

              <Form.Item
                label="재시도 횟수"
                name="retryCount"
                initialValue={3}
              >
                <Input type="number" min={0} max={10} placeholder="3" />
              </Form.Item>
            </Space>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.method !== currentValues.method
              }
            >
              {({ getFieldValue }) => {
                const method = getFieldValue('method');
                if (method === 'POST' || method === 'PUT') {
                  return (
                    <Form.Item label="요청 본문" name="body">
                      <TextArea
                        rows={4}
                        placeholder="JSON 또는 텍스트 데이터"
                      />
                    </Form.Item>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Panel>
        </Collapse>

        <Divider />

        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={testing}
            onClick={testApiConnection}
          >
            연결 테스트
          </Button>
          {testResult && (
            <Button
              icon={<EyeOutlined />}
              onClick={() => message.info('미리보기 기능은 개발 중입니다.')}
            >
              응답 미리보기
            </Button>
          )}
        </Space>

        {testResult && (
          <Card
            title="테스트 결과"
            size="small"
            style={{ marginTop: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>상태: {testResult.status} {testResult.statusText}</Text>
              <Text type="secondary">응답 시간: {testResult.headers?.['x-response-time']}</Text>
              <div>
                <Text strong>응답 데이터 (샘플):</Text>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: '8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </div>
            </Space>
          </Card>
        )}
      </Form>
    </BaseNodeConfig>
  );
};

export default ApiQueryConfig;