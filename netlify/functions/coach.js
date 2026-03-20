const https = require('https');

exports.handler = async function (event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { system, messages } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Messages array is missing or empty' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set on the server' }) };
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: system || '',
    messages: messages,
  });

  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  let parsed;
  try {
    parsed = JSON.parse(result.body);
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Could not parse Anthropic response' }) };
  }

  if (result.status !== 200) {
    const errMsg = (parsed.error && parsed.error.message) ? parsed.error.message : ('Anthropic error: status ' + result.status);
    return { statusCode: result.status, headers: cors, body: JSON.stringify({ error: errMsg }) };
  }

  const textBlock = parsed.content && parsed.content.find(function(b) { return b.type === 'text'; });
  const reply = textBlock ? textBlock.text : '';

  return { statusCode: 200, headers: cors, body: JSON.stringify({ reply: reply }) };
};
