import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Typography } from 'antd';
import { SettingOutlined, CheckCircleOutlined, CloseCircleOutlined, ApiOutlined } from '@ant-design/icons';
import { getAIConfig, saveAIConfig, testAIConnection, getAIStatus } from '../api';

const { Option } = Select;
const { Text } = Typography;

const PROVIDER_INFO = {
  zhipu: {
    name: '智谱AI (GLM)',
    desc: '智谱清言，国内大模型，默认推荐',
    models: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-4-long', 'glm-3-turbo'],
  },
  openai_compatible: {
    name: 'OpenAI兼容接口',
    desc: '支持DeepSeek、通义千问、Moonshot、OpenAI等兼容API',
    models: [],
  },
  custom: {
    name: '自定义接口',
    desc: '自定义任意OpenAI格式兼容的API',
    models: [],
  },
};

export default function ConfigPage() {
  const [form] = Form.useForm();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('zhipu');

  useEffect(() => {
    loadConfig();
    loadStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await getAIConfig();
      setConfig(res.data);
      setSelectedProvider(res.data.provider || 'zhipu');
      form.setFieldsValue(res.data);
    } catch (e) {
      console.error('加载配置失败', e);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await getAIStatus();
      setStatus(res.data);
    } catch (e) {
      console.error('加载状态失败', e);
    }
  };

  const collectFormValues = () => {
    const allValues = form.getFieldsValue(true);
    if (!allValues.provider) allValues.provider = selectedProvider;
    return allValues;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const allValues = collectFormValues();
      const provider = allValues.provider || selectedProvider;
      const providerConfig = allValues[provider] || {};

      if (!providerConfig.apiKey) {
        message.error('请输入API Key');
        setLoading(false);
        return;
      }
      if (provider !== 'zhipu' && !providerConfig.baseUrl) {
        message.error('请输入Base URL');
        setLoading(false);
        return;
      }
      if (!providerConfig.model) {
        message.error(provider === 'zhipu' ? '请选择模型' : '请输入模型名称');
        setLoading(false);
        return;
      }

      await saveAIConfig(allValues);
      message.success('配置已保存');
      loadConfig();
      loadStatus();
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const allValues = collectFormValues();
      const provider = allValues.provider || selectedProvider;
      const providerConfig = allValues[provider] || {};

      if (!providerConfig.apiKey) {
        message.error('请先填写API Key并保存配置');
        setTesting(false);
        return;
      }

      await saveAIConfig(allValues);

      message.loading({ content: '正在测试连接...', key: 'test', duration: 0 });
      const res = await testAIConnection();
      if (res.success) {
        message.success({ content: `连接成功！模型回复: ${res.data?.message}`, key: 'test' });
      } else {
        message.error({ content: `连接失败: ${res.error}`, key: 'test' });
      }
      loadStatus();
    } catch (e) {
      message.error({ content: `连接失败: ${e.message}`, key: 'test' });
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (val) => {
    setSelectedProvider(val);
    form.setFieldValue('provider', val);
  };

  return (
    <div className="max-w-4xl mx-auto text-gray-800">
      {/* 状态提示 */}
      <div className={'rounded-2xl border p-5 mb-6 ' + (status?.configured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
        <div className="flex items-start space-x-4">
          <div className={'p-2 rounded-lg ' + (status?.configured ? 'bg-emerald-100' : 'bg-amber-100')}>
            {status?.configured ? <CheckCircleOutlined className="text-emerald-600 text-lg" /> : <CloseCircleOutlined className="text-amber-600 text-lg" />}
          </div>
          <div className="flex-1">
            <h3 className={'text-lg font-semibold ' + (status?.configured ? 'text-emerald-800' : 'text-amber-800')}>
              {status?.configured ? 'AI模型已配置' : 'AI模型未配置'}
            </h3>
            <p className={(status?.configured ? 'text-emerald-700' : 'text-amber-700')}>
              {status?.configured
                ? '提供商: ' + (PROVIDER_INFO[status.provider]?.name || status.provider) + '，模型: ' + (status.model || '')
                : '请先配置API Key后才能使用AI分析和文案生成功能'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <SettingOutlined className="text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">模型配置</h2>
          </div>
        </div>

        <div className="p-6">
          <Form form={form} layout="vertical" className="space-y-6">

            {/* 选择提供商 */}
            <Form.Item name="provider" label="模型提供商">
              <Select onChange={handleProviderChange} size="large">
                {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                  <Option key={key} value={key}>
                    <div>
                      <strong>{info.name}</strong>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{info.desc}</Text>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <hr className="my-6 border-gray-200" />

            {/* 智谱AI配置 */}
            {selectedProvider === 'zhipu' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="text-blue-600 text-lg">ℹ️</div>
                    <div className="text-blue-800">
                      智谱AI是国内大模型服务商，访问 <a href="https://open.bigmodel.cn" className="text-blue-600 hover:underline">https://open.bigmodel.cn</a> 注册获取API Key
                    </div>
                  </div>
                </div>
                <Form.Item name={['zhipu', 'apiKey']} label="API Key">
                  <Input.Password placeholder="请输入智谱API Key" size="large" />
                </Form.Item>
                <Form.Item name={['zhipu', 'model']} label="模型">
                  <Select placeholder="请选择模型" size="large">
                    {PROVIDER_INFO.zhipu.models.map(m => (
                      <Option key={m} value={m}>{m}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}

            {/* OpenAI兼容接口配置 */}
            {selectedProvider === 'openai_compatible' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="text-blue-600 text-lg">ℹ️</div>
                    <div className="text-blue-800">
                      支持任何OpenAI兼容的API，如DeepSeek、通义千问、Moonshot等
                    </div>
                  </div>
                </div>
                <Form.Item name={['openai_compatible', 'apiKey']} label="API Key">
                  <Input.Password placeholder="请输入API Key" size="large" />
                </Form.Item>
                <Form.Item name={['openai_compatible', 'baseUrl']} label="Base URL">
                  <Input placeholder="https://api.openai.com/v1" size="large" />
                </Form.Item>
                <Form.Item name={['openai_compatible', 'model']} label="模型名称">
                  <Input placeholder="如: gpt-4, deepseek-chat, qwen-turbo 等" size="large" />
                </Form.Item>
              </>
            )}

            {/* 自定义接口配置 */}
            {selectedProvider === 'custom' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="text-blue-600 text-lg">ℹ️</div>
                    <div className="text-blue-800">
                      自定义任意兼容OpenAI Chat Completions格式的API接口
                    </div>
                  </div>
                </div>
                <Form.Item name={['custom', 'apiKey']} label="API Key">
                  <Input.Password placeholder="请输入API Key" size="large" />
                </Form.Item>
                <Form.Item name={['custom', 'baseUrl']} label="API URL">
                  <Input placeholder="https://your-api.com/v1" size="large" />
                </Form.Item>
                <Form.Item name={['custom', 'model']} label="模型名称">
                  <Input placeholder="请输入模型名称" size="large" />
                </Form.Item>
              </>
            )}

            <hr className="my-6 border-gray-200" />

            <div className="flex items-center space-x-4">
              <Button
                type="primary"
                onClick={handleSave}
                loading={loading}
                size="large"
                className="primary-button flex items-center space-x-2 px-6 py-3 text-lg"
              >
                保存配置
              </Button>
              <Button
                icon={<ApiOutlined />}
                onClick={handleTest}
                loading={testing}
                size="large"
                className="secondary-button flex items-center space-x-2 px-6 py-3 text-lg"
              >
                保存并测试连接
              </Button>
            </div>

          </Form>
        </div>
      </div>
    </div>
  );
}
