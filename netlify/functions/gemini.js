const axios = require('axios');

// 全局API统计
const apiStats = new Map();

exports.handler = async (event) => {
  try {
    // 环境变量配置
    const API_KEYS = process.env.API_KEYS.split(',');
    const MAX_RETRY = parseInt(process.env.RETRY_TIMES) || 3;
    const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 100;

    // 初始化统计
    if (apiStats.size === 0) {
      API_KEYS.forEach((_, index) => {
        apiStats.set(index, { count: 0, lastUsed: null });
      });
    }

    // 选择可用密钥
    const availableKeys = Array.from(apiStats.entries())
      .filter(([_, stat]) => stat.count < RATE_LIMIT)
      .map(([index]) => index);

    if (availableKeys.length === 0) {
      return { statusCode: 429, body: JSON.stringify({ error: "所有API密钥均已超限" }) };
    }

    // 随机选择密钥
    const keyIndex = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    const currentKey = API_KEYS[keyIndex];
    
    // 请求处理
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${currentKey}`,
        JSON.parse(event.body),
        { timeout: 5000 }
      );

      // 更新统计
      apiStats.get(keyIndex).count++;
      apiStats.get(keyIndex).lastUsed = new Date().toISOString();

      return {
        statusCode: 200,
        body: JSON.stringify(response.data),
        headers: { 
          'Content-Type': 'application/json',
          'X-Used-Key': `key_${keyIndex + 1}`
        }
      };
      
    } catch (error) {
      // 失败处理
      apiStats.get(keyIndex).count += 3; // 失败惩罚
      throw error;
    }

  } catch (err) {
    // 错误处理
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "服务暂时不可用，请稍后重试" })
    };
  }
};
