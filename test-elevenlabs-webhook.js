import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';

const SIGNING_SECRET = 'wsec_feeb0547743237b257cccff118ea3c3d0ef01167144f6d9fcbcbea14b1d5a525';

// ✅ GỬI ĐẾN BACKEND - backend sẽ process và gửi tiếp đến n8n
// const WEBHOOK_URL = 'http://localhost:5000/api/voice-calls/webhook';

// ❌ ĐỪNG gửi trực tiếp đến n8n - n8n sẽ thiếu patient info
// const WEBHOOK_URL = 'https://n8n.kurza.id.vn/webhook/voice-event';
const WEBHOOK_URL = 'https://n8n.kurza.id.vn/webhook-test/voice-event';

function generateSignature(rawBody, timestamp) {
  const payload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  return `t=${timestamp},v0=${hmac.update(payload).digest('hex')}`;
}

async function testElevenLabsWebhook() {
  try {
    console.log('🧪 Sending FULL RAW JSON payload...\n');

    // Đọc và parse payload
    const rawBody = fs.readFileSync('./payload.json', 'utf8');
    const payload = JSON.parse(rawBody);
    
    // Backend verify bằng JSON.stringify(req.body), nên phải stringify giống backend
    const bodyForSignature = JSON.stringify(payload);

    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = generateSignature(bodyForSignature, timestamp);

    const response = await axios.post(
      WEBHOOK_URL,
      payload,  // Gửi object, axios sẽ stringify
      {
        headers: {
          'Content-Type': 'application/json',
          'elevenlabs-signature': signatureHeader
        }
      }
    );

    console.log('✅ Thành công!');
    console.log('Status:', response.status);
    console.log(response.data);

  } catch (err) {
    console.error('\n❌ FAILED');
    console.error('Message:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

testElevenLabsWebhook();
