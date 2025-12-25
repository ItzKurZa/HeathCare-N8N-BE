# Debug: Tại Sao Không Gửi Được Email Từ N8N?

## Checklist Kiểm Tra

### 1. Kiểm tra Backend Alert Endpoint
```bash
# Test endpoint alert trực tiếp
curl -X POST https://bennett-unvanquishable-liquidly.ngrok-free.dev/api/alerts/send \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "patientName": "Nguyễn Test",
    "phone": "0343107931",
    "appointmentId": "test_123",
    "conversationId": "conv_test",
    "sentiment": "negative",
    "transcript": "User: 1\nUser: 1\nUser: 1",
    "surveyData": {
      "userAnswers": ["1", "1", "1"],
      "numericScores": [1, 1, 1]
    }
  }'
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "message": "Alert sent successfully",
  "data": {
    "alertId": "xxx",
    "emailSent": true,
    "emailId": "xxx"
  }
}
```

### 2. Kiểm tra Email Service Config

File: `HeathCare-N8N-BE/.env`

```bash
# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # App password, not regular password!
SMTP_FROM=your-email@gmail.com
ALERT_EMAIL=recipient@example.com  # Email nhận alert
```

**Lưu ý:** 
- Gmail cần dùng **App Password**, không phải password thường
- Tạo App Password tại: https://myaccount.google.com/apppasswords

### 3. Kiểm tra N8N Workflow Execution

**Bước 1: Chạy Test Script**
```bash
cd HeathCare-N8N-BE
node test-elevenlabs-webhook.js
```

**Bước 2: Xem N8N Executions**
- Vào n8n dashboard
- Mở tab "Executions"
- Tìm execution mới nhất của workflow "Healthcare Voice Survey"
- Click vào để xem chi tiết

**Bước 3: Kiểm tra từng node**

#### Node "Parse Event"
Output mong đợi:
```json
{
  "conversationId": "conv_4101kd9wsf1vfp3v8e513fxcn16n",
  "patientName": "Test Patient",
  "phone": "+84343107931",
  "sentiment": "negative",
  "transcript": "Agent: ... User: 1 ...",
  ...
}
```

#### Node "Evaluate Sentiment"
Output mong đợi:
```json
{
  ...
  "evaluation": {
    "sentiment": "negative",
    "isNegative": true,
    "hasLowScores": true,
    "userAnswers": ["1", "1", "1"],
    "numericScores": [1, 1, 1]
  }
}
```

#### Node "Is Negative?"
- **True path**: Khi `evaluation.sentiment === "negative"` HOẶC `evaluation.hasLowScores === true`
- **False path**: Khi không thỏa điều kiện trên
- Kiểm tra xem có đi vào True path không

#### Node "Send Alert"
Request body:
```json
{
  "patientName": "Test Patient",
  "phone": "+84343107931",
  "appointmentId": "test_appointment",
  "conversationId": "conv_xxx",
  "sentiment": "negative",
  "transcript": "...",
  "surveyData": {
    "userAnswers": ["1", "1", "1"],
    "numericScores": [1, 1, 1]
  },
  "analysis": {...}
}
```

**Lỗi thường gặp:**
- ❌ `patientName` is undefined → Backend chưa gửi `patient_name`
- ❌ 404 Not Found → URL sai hoặc backend chưa chạy
- ❌ 500 Internal Server Error → Backend lỗi, xem logs

### 4. Kiểm tra Backend Logs

```bash
# Trong terminal chạy backend, tìm các log sau:

# 1. Webhook nhận từ ElevenLabs
📞 Received ElevenLabs webhook: {...}

# 2. Tìm voice call record
⚠️ No voice call record found for conversation_id: conv_xxx
# HOẶC
✅ Found voice call record

# 3. Gửi đến n8n
📤 Sending to n8n webhook: https://n8n.kurza.id.vn/webhook/voice-event
Data: {
  "patient_name": "Test Patient",  // ← Quan trọng!
  "phone": "+84343107931",
  "sentiment": "negative",
  ...
}
✅ n8n webhook response: 200

# 4. Nhận request từ n8n
🚨 Alert send request body: {...}
📧 Sending alert for: Test Patient
✅ Email sent successfully
```

### 5. Debug Step-by-Step

#### Bước 1: Test trực tiếp backend webhook
```bash
# Gửi data giống ElevenLabs
node test-elevenlabs-webhook.js
```

Kiểm tra:
- ✅ Backend nhận webhook?
- ✅ Tìm được voice_call record?
- ✅ Gửi data đến n8n?

#### Bước 2: Test n8n workflow
Vào n8n, click "Execute Workflow" và dùng test data:
```json
{
  "conversation_id": "conv_test",
  "patient_name": "Nguyễn Test",
  "phone": "0343107931",
  "sentiment": "negative",
  "transcript": "User: 1\nUser: 1",
  "analysis": {}
}
```

Kiểm tra:
- ✅ Parse Event có extract đúng patientName?
- ✅ Evaluate Sentiment có detect negative?
- ✅ Is Negative? có đi vào True path?
- ✅ Send Alert có gọi backend?

#### Bước 3: Test alert endpoint trực tiếp
```bash
curl -X POST http://localhost:5000/api/alerts/send \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Test",
    "phone": "0343107931",
    "sentiment": "negative"
  }'
```

Kiểm tra:
- ✅ Backend nhận request?
- ✅ Email service được gọi?
- ✅ Email được gửi thành công?

### 6. Common Issues & Solutions

#### Issue 1: Backend không nhận webhook từ ElevenLabs
**Nguyên nhân:**
- ElevenLabs webhook URL chưa đúng
- Backend chưa chạy
- Ngrok chưa chạy hoặc URL đổi

**Giải pháp:**
1. Kiểm tra ngrok đang chạy: `ngrok http 5000`
2. Copy URL mới từ ngrok
3. Cập nhật vào ElevenLabs webhook settings
4. Test lại với `node test-elevenlabs-webhook.js`

#### Issue 2: N8N không nhận data từ backend
**Nguyên nhân:**
- N8N webhook URL sai
- Backend không gọi n8n webhook
- Network issue

**Giải pháp:**
1. Kiểm tra `.env`: `N8N_WEBHOOK_URL=https://n8n.kurza.id.vn/webhook/voice-event`
2. Kiểm tra backend logs có dòng "Sending to n8n webhook"
3. Test với curl:
```bash
curl -X POST https://n8n.kurza.id.vn/webhook/voice-event \
  -H "Content-Type: application/json" \
  -d '{"patient_name":"Test","sentiment":"negative"}'
```

#### Issue 3: N8N workflow không trigger alert
**Nguyên nhân:**
- Condition "Is Negative?" không match
- Data format không đúng
- Node Parse Event hoặc Evaluate Sentiment lỗi

**Giải pháp:**
1. Xem execution details trong n8n
2. Kiểm tra output của từng node
3. Verify `evaluation.sentiment === "negative"` hoặc `evaluation.hasLowScores === true`

#### Issue 4: Backend nhận request nhưng không gửi email
**Nguyên nhân:**
- Email service config sai
- SMTP credentials không đúng
- Gmail block "less secure apps"

**Giải pháp:**
1. Kiểm tra `.env` có đủ config email
2. Dùng Gmail App Password thay vì password thường
3. Kiểm tra logs email service:
```bash
# Trong backend logs
📧 Sending alert for: Test Patient
✅ Email sent: { messageId: 'xxx' }
# HOẶC lỗi
❌ Email send error: Invalid credentials
```

#### Issue 5: Email không đến hộp thư
**Nguyên nhân:**
- Email vào spam
- Email server delay
- ALERT_EMAIL sai

**Giải pháp:**
1. Kiểm tra spam folder
2. Kiểm tra `.env`: `ALERT_EMAIL=correct-email@example.com`
3. Test với email khác
4. Xem backend logs có `messageId` không

### 7. Test End-to-End

**Complete Flow Test:**
1. ✅ Start backend: `npm start` trong `HeathCare-N8N-BE`
2. ✅ Start ngrok: `ngrok http 5000`
3. ✅ Update ElevenLabs webhook URL
4. ✅ Chạy test: `node test-elevenlabs-webhook.js`
5. ✅ Kiểm tra backend logs
6. ✅ Kiểm tra n8n executions
7. ✅ Kiểm tra email inbox

**Expected Timeline:**
- 0s: Test script gửi webhook
- 1s: Backend nhận và process
- 2s: Backend gửi đến n8n
- 3s: N8N workflow chạy
- 4s: N8N gọi alert endpoint
- 5s: Backend gửi email
- 10s: Email đến hộp thư

### 8. Quick Debug Commands

```bash
# 1. Kiểm tra backend đang chạy
curl http://localhost:5000/health

# 2. Kiểm tra ngrok
curl https://your-ngrok-url.ngrok-free.dev/health

# 3. Test ElevenLabs webhook
node test-elevenlabs-webhook.js

# 4. Test alert endpoint
curl -X POST http://localhost:5000/api/alerts/send \
  -H "Content-Type: application/json" \
  -d '{"patientName":"Test","sentiment":"negative"}'

# 5. Xem logs realtime
# Terminal 1: Backend
npm start

# Terminal 2: Test
node test-elevenlabs-webhook.js

# 6. Kiểm tra Firebase
# Vào Firebase Console > Firestore
# Collection: alerts
# Xem có document mới không
```

### 9. Final Checklist

Trước khi báo lỗi, đảm bảo:
- [ ] Backend đang chạy (`npm start`)
- [ ] Ngrok đang chạy và URL đúng
- [ ] ElevenLabs webhook URL đã cập nhật
- [ ] `.env` có đủ config (SMTP, N8N_WEBHOOK_URL, ALERT_EMAIL)
- [ ] Gmail App Password đã tạo (nếu dùng Gmail)
- [ ] N8N workflow đã import và activate
- [ ] Test script chạy không lỗi
- [ ] Backend logs không có lỗi
- [ ] N8N execution thành công
- [ ] Firebase có document mới trong collection `alerts`

Nếu tất cả đều ✅ mà vẫn không nhận email:
1. Kiểm tra spam folder
2. Thử email khác
3. Xem backend logs có messageId không
4. Contact SMTP provider (Gmail, etc.)
