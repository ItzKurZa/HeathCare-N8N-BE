# Hướng Dẫn Test Email Alert End-to-End

## Bước 1: Khởi động Backend

```powershell
# Terminal 1 - Backend
cd C:\Nam4_Ky1\HeathCare-N8N-BE
npm start
```

Đợi thấy log:
```
✅ Server running on port 5000
✅ Firebase connected
```

## Bước 2: Chạy Test Script

```powershell
# Terminal 2 - Test
cd C:\Nam4_Ky1\HeathCare-N8N-BE
node test-elevenlabs-webhook.js
```

## Kết Quả Mong Đợi

### Backend Logs (Terminal 1):
```
📞 Received ElevenLabs webhook: {
  "type": "post_call_transcription",
  "conversation_id": "conv_4101kd9wsf1vfp3v8e513fxcn16n",
  "data": { ... }
}

⚠️ No voice call record found for conversation_id: conv_4101kd9wsf1vfp3v8e513fxcn16n
📝 Creating new voice call record for test...

📤 Sending to n8n webhook: https://n8n.kurza.id.vn/webhook/voice-event
Data: {
  "type": "post_call_transcription",
  "conversation_id": "conv_4101kd9wsf1vfp3v8e513fxcn16n",
  "patient_name": "Test Patient",       // ← Có patient info!
  "phone": "+84343107931",
  "sentiment": "negative",              // ← Có sentiment!
  "transcript": "User: 1\nUser: 1...",
  ...
}

✅ n8n webhook response: 200

✅ Webhook processed successfully
```

### Test Script Output (Terminal 2):
```
🧪 Sending FULL RAW JSON payload...

✅ Thành công!
Status: 200
{
  "success": true,
  "message": "Webhook processed successfully",
  "conversation_id": "conv_4101kd9wsf1vfp3v8e513fxcn16n"
}
```

### N8N Execution:
Vào n8n → Executions → Xem execution mới nhất:

**Parse Event Output:**
```json
{
  "conversationId": "conv_4101kd9wsf1vfp3v8e513fxcn16n",
  "patientName": "Test Patient",        // ✅ Có rồi!
  "phone": "+84343107931",
  "sentiment": "negative",              // ✅ Có rồi!
  ...
}
```

**Evaluate Sentiment Output:**
```json
{
  ...
  "evaluation": {
    "sentiment": "negative",
    "isNegative": true,                 // ✅ Sẽ trigger alert!
    "hasLowScores": true,
    "numericScores": [1, 1, 1]
  }
}
```

**Is Negative?** → Đi vào **TRUE path** → Gọi **Send Alert**

**Send Alert:** Gửi request đến `http://localhost:5000/api/alerts/send`

**Backend Logs:**
```
🚨 Alert send request body: {
  "patientName": "Test Patient",
  "phone": "+84343107931",
  "sentiment": "negative",
  ...
}

📧 Sending alert for: Test Patient
✅ Email sent successfully
```

**Respond to Webhook:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "conversationId": "conv_4101kd9wsf1vfp3v8e513fxcn16n",
  "patientName": "Test Patient",
  "sentiment": "negative",
  "alertSent": true,                    // ✅ Đã gửi alert!
  "timestamp": "2025-12-25T..."
}
```

## Nếu Vẫn Lỗi

### Lỗi: Backend không nhận webhook
```
Error: connect ECONNREFUSED 127.0.0.1:5000
```

**Giải pháp:** Backend chưa chạy → Khởi động lại Terminal 1

### Lỗi: N8N không nhận data từ backend
Kiểm tra backend logs có dòng:
```
📤 Sending to n8n webhook: ...
✅ n8n webhook response: 200
```

Nếu KHÔNG có → Backend chưa gọi n8n
Nếu CÓ nhưng n8n không chạy → Kiểm tra N8N_WEBHOOK_URL trong `.env`

### Lỗi: Email không gửi
Backend logs:
```
🚨 Alert send request body: ...
📧 Sending alert for: Test Patient
❌ Email send error: Invalid credentials
```

**Giải pháp:** Kiểm tra `.env`:
```bash
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Gmail App Password!
ALERT_EMAIL=recipient@example.com
```

## Troubleshooting Quick Commands

```powershell
# 1. Kiểm tra backend đang chạy
curl http://localhost:5000/health

# 2. Xem các port đang dùng
netstat -ano | findstr :5000

# 3. Kill process nếu port bị chiếm
# Lấy PID từ lệnh trên
taskkill /PID <PID> /F

# 4. Restart backend
cd C:\Nam4_Ky1\HeathCare-N8N-BE
npm start

# 5. Test lại
node test-elevenlabs-webhook.js
```

## Flow Chính Xác

```
┌─────────────────────┐
│  Test Script        │
│  (hoặc ElevenLabs)  │
└──────────┬──────────┘
           │ POST /api/voice-calls/webhook
           ▼
┌─────────────────────┐
│  Backend            │
│  - Verify signature │
│  - Tìm voice_call   │
│  - Lấy patient info │
│  - Phân tích sentiment
└──────────┬──────────┘
           │ sendToN8NWebhook()
           │ POST /webhook/voice-event
           ▼
┌─────────────────────┐
│  N8N Workflow       │
│  - Parse Event      │
│  - Evaluate         │
│  - Is Negative?     │
└──────────┬──────────┘
           │ TRUE (negative)
           │ POST /api/alerts/send
           ▼
┌─────────────────────┐
│  Backend Alert API  │
│  - Call emailService│
│  - Send SMTP email  │
│  - Save to Firebase │
└─────────────────────┘
           │
           ▼
     📧 Email Inbox
```

## Checklist Cuối Cùng

Trước khi test, đảm bảo:
- [ ] Backend đang chạy (`npm start`)
- [ ] File `.env` có đầy đủ config:
  - [ ] SMTP_USER
  - [ ] SMTP_PASS (App Password nếu dùng Gmail)
  - [ ] ALERT_EMAIL
  - [ ] N8N_WEBHOOK_URL
- [ ] N8N workflow đã import và activate
- [ ] Test script đã sửa URL đúng (localhost:5000, không phải n8n)
- [ ] Firebase có collection `voice_calls` và `alerts`

Sau khi test, kiểm tra:
- [ ] Backend logs thấy "Webhook processed successfully"
- [ ] Backend logs thấy "Sending to n8n webhook"
- [ ] N8N execution status: Success
- [ ] N8N execution có patientName và sentiment
- [ ] Backend logs thấy "Email sent successfully"
- [ ] Email đã nhận (hoặc trong spam folder)
- [ ] Firebase collection `alerts` có document mới
