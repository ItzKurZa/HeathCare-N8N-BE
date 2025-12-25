# Sửa N8N Workflow để Lấy Thông Tin Bệnh Nhân

## Vấn đề hiện tại

N8N workflow không lấy được thông tin bệnh nhân để gửi email vì:

1. **ElevenLabs webhook gốc** không có thông tin bệnh nhân (chỉ có conversation_id, transcript)
2. **Backend webhook** (`/api/voice-calls/webhook`) đã xử lý và gửi data đến n8n với đầy đủ thông tin
3. **N8N cần nhận data từ backend**, không phải từ ElevenLabs trực tiếp

## Flow chính xác

```
ElevenLabs → Backend Webhook → Firebase → N8N Webhook → Gửi Email
              (/voice-calls/webhook)         (/webhook/voice-event)
```

### Chi tiết từng bước:

1. **ElevenLabs** gửi webhook với format:
```json
{
  "type": "post_call_transcription",
  "conversation_id": "conv_xxx",
  "data": {
    "conversation_id": "conv_xxx",
    "transcript": [...],
    "analysis": {...},
    "metadata": {...}
  }
}
```

2. **Backend** (`/api/voice-calls/webhook`) xử lý:
   - Verify signature
   - Tìm voice_call record trong Firebase theo `elevenlabsCallId`
   - Lấy thông tin `patientName`, `phone`, `appointmentId`
   - Phân tích transcript và sentiment
   - Gửi đến n8n với format:

```json
{
  "type": "post_call_transcription",
  "conversation_id": "conv_xxx",
  "appointment_id": "appt_xxx",
  "patient_name": "Nguyễn Thị Nguyên",
  "phone": "0343107931",
  "status": "done",
  "transcript": "Agent: ... User: ...",
  "sentiment": "negative",
  "analysis": {...},
  "ai_analysis": {...},
  "metadata": {...}
}
```

3. **N8N** nhận data từ backend và:
   - Parse event
   - Đánh giá sentiment
   - Gửi email nếu negative

## Sửa N8N Workflow

### Node 1: Webhook Voice1
```javascript
// Không cần sửa - nhận raw data từ backend
{
  "httpMethod": "POST",
  "path": "voice-event",
  "responseMode": "responseNode"
}
```

### Node 2: Parse Event (SỬA)
```javascript
const data = $input.first().json;

console.log('📥 Webhook data received:', JSON.stringify(data, null, 2));

// Backend đã gửi data structured sẵn
const processedData = {
  conversationId: data.conversation_id,
  appointmentId: data.appointment_id,
  patientName: data.patient_name,
  phone: data.phone,
  status: data.status,
  transcript: data.transcript,
  sentiment: data.sentiment,
  analysis: data.analysis,
  aiAnalysis: data.ai_analysis,
  metadata: data.metadata,
  eventType: data.type,
  rawData: data
};

console.log('✅ Parsed data:', {
  patientName: processedData.patientName,
  sentiment: processedData.sentiment,
  hasTranscript: !!processedData.transcript
});

return [{ json: processedData }];
```

### Node 3: Evaluate Sentiment (SỬA)
```javascript
const item = $('Parse Event').item.json;

// Sentiment đã được backend phân tích
const sentiment = item.sentiment || 'unknown';
const isNegative = sentiment === 'negative';

// Parse transcript để lấy numeric scores (nếu cần)
const transcript = item.transcript || '';
const lines = transcript.split('\n');
const userAnswers = lines
  .filter(l => l.startsWith('User:'))
  .map(l => l.replace('User:', '').trim());

const numericScores = userAnswers
  .map(msg => Number(msg))
  .filter(n => !isNaN(n) && n > 0);

return {
  json: {
    ...item,
    evaluation: {
      sentiment: sentiment,
      isNegative: isNegative,
      userAnswers: userAnswers,
      numericScores: numericScores,
      hasLowScores: numericScores.some(n => n <= 3)
    }
  }
};
```

### Node 4: Is Negative? (SỬA)
```
Conditions:
  - {{ $json.evaluation.sentiment }} equals "negative"
  OR
  - {{ $json.evaluation.hasLowScores }} equals true
```

### Node 5: Send Alert (SỬA)
```javascript
// URL: Backend alert endpoint
POST https://bennett-unvanquishable-liquidly.ngrok-free.dev/api/alerts/send

// Body (JSON):
{
  "patientName": "={{ $json.patientName }}",
  "phone": "={{ $json.phone }}",
  "appointmentId": "={{ $json.appointmentId }}",
  "conversationId": "={{ $json.conversationId }}",
  "sentiment": "={{ $json.sentiment }}",
  "transcript": "={{ $json.transcript }}",
  "surveyData": {
    "userAnswers": "={{ $json.evaluation.userAnswers }}",
    "numericScores": "={{ $json.evaluation.numericScores }}"
  },
  "analysis": "={{ $json.analysis }}"
}
```

### Node 6: Respond to Webhook (SỬA)
```javascript
{
  "success": true,
  "message": "Webhook processed successfully",
  "conversationId": "={{ $json.conversationId }}",
  "patientName": "={{ $json.patientName }}",
  "sentiment": "={{ $json.evaluation.sentiment }}",
  "alertSent": "={{ $json.evaluation.isNegative }}",
  "timestamp": "={{ new Date().toISOString() }}"
}
```

## Kiểm tra Backend Config

### 1. Đảm bảo backend gửi đến n8n
File: `src/infrastructure/services/voice.services.js`

```javascript
async sendToN8NWebhook(data) {
    try {
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 
            'https://n8n.kurza.id.vn/webhook/voice-event';
        
        console.log('📤 Sending to n8n webhook:', n8nWebhookUrl);
        console.log('Data:', JSON.stringify(data, null, 2));
        
        const response = await axios.post(n8nWebhookUrl, data, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ n8n webhook response:', response.status);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send to n8n:', error.message);
        throw error;
    }
}
```

### 2. Kiểm tra .env
```bash
N8N_WEBHOOK_URL=https://n8n.kurza.id.vn/webhook/voice-event
```

## Test Flow

### 1. Test với script
```bash
cd HeathCare-N8N-BE
node test-elevenlabs-webhook.js
```

### 2. Kiểm tra logs
- **Backend logs**: Xem data gửi đến n8n
- **N8N Executions**: Xem workflow có chạy không
- **Email**: Kiểm tra có nhận được email không

### 3. Debug nếu lỗi
- Xem n8n execution details
- Kiểm tra output của từng node
- Xem error message

## Lưu ý quan trọng

1. **ElevenLabs chỉ gửi đến backend**, không gửi trực tiếp đến n8n
2. **Backend xử lý và enrich data** với patient info từ Firebase
3. **N8N nhận data đã processed** từ backend
4. **Không cần gọi lại backend** trong n8n để lấy patient info
