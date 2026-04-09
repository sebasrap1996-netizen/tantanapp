const https = require('https');
const http = require('http');

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testConnection() {
  try {
    // Login
    const loginData = await makeRequest('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: 'admin@aviator.com', password: 'admin123' }));
    
    const token = loginData.access_token || loginData.token;
    console.log('🔑 Token obtenido');
    
    // Iniciar conexión WebSocket
    const startData = await makeRequest('http://localhost:3001/api/aviator/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({}));
    
    console.log('📋 Start result:');
    console.log(JSON.stringify(startData, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testConnection();
