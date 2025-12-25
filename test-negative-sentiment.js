import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';

const SIGNING_SECRET = 'wsec_feeb0547743237b257cccff118ea3c3d0ef01167144f6d9fcbcbea14b1d5a525';
const WEBHOOK_URL = 'http://localhost:5000/api/voice-calls/webhook';

function generateSignature(rawBody, timestamp) {
  const payload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  return `t=${timestamp},v0=${hmac.update(payload).digest('hex')}`;
}

async function testNegativeSentiment() {
  try {
    console.log('🧪 Testing NEGATIVE sentiment to trigger email alert...\n');

    // Payload với NEGATIVE sentiment
    const payload = {
      "conversation_id": "conv_test_negative_123",
      "agent_id": "agent_0301kd7d8z2ae25rnr5ear1qxhft",
      "type": "post_call_transcription",
      "data": {
        "agent_id": "agent_0301kd7d8z2ae25rnr5ear1qxhft",
        "conversation_id": "conv_test_negative_123",
        "status": "done",
        "user_id": null,
        "branch_id": "agtbrch_test",
        "transcript": [
          {
            "role": "agent",
            "message": "Xin chào, bạn đánh giá mức độ hài lòng từ 1-10?"
          },
          {
            "role": "user",
            "message": "1"  // ĐÂY LÀ ĐIỂM RẤT THẤP!
          },
          {
            "role": "agent",
            "message": "Chất lượng dịch vụ từ 1-5 sao?"
          },
          {
            "role": "user",
            "message": "1"  // RẤT TỆ!
          },
          {
            "role": "agent",
            "message": "Cơ sở vật chất từ 1-5 sao?"
          },
          {
            "role": "user",
            "message": "2"  // VẪN THẤP
          }
        ],
        "analysis": {
          "call_successful": "success",
          "transcript_summary": "Khách hàng rất không hài lòng với dịch vụ, đánh giá 1/10 và 1/5 sao."
        },
        "metadata": {
          "start_time_unix_secs": Math.floor(Date.now() / 1000),
          "call_duration_secs": 45
        }
      }
    };

    const bodyForSignature = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = generateSignature(bodyForSignature, timestamp);

    const response = await axios.post(
      WEBHOOK_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'elevenlabs-signature': signatureHeader
        }
      }
    );

    console.log('✅ Thành công!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    console.log('\n📧 Kiểm tra email alert:');
    console.log('1. Xem backend logs có "📧 Sending alert for: Test Patient"');
    console.log('2. Vào n8n Executions xem có execution mới');
    console.log('3. Kiểm tra email inbox (hoặc spam folder)');

  } catch (err) {
    console.error('\n❌ FAILED');
    console.error('Message:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

testNegativeSentiment();
