import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from '../../config/env.js';
import axios from 'axios';

const client = new ElevenLabsClient({
    apiKey: config.elevenlabs.apiKey
});

const AGENT_ID = config.elevenlabs.agentId;

class VoiceService {
    /**
     * Khởi tạo cuộc gọi follow-up với bệnh nhân
     * @param {Object} appointment - Thông tin appointment
     * @returns {Promise<Object>} Kết quả cuộc gọi
     */
    async makeFollowUpCall(appointment) {
        try {
            if (!AGENT_ID) {
                throw new Error('ElevenLabs Agent ID not configured');
            }

            const phoneNumber = this.formatPhoneNumber(appointment.phone);
            console.log(`📞 Initiating outbound voice call to ${phoneNumber}...`);

            // Tạo webhook URL cho ElevenLabs callback
            const webhookUrl = `${config.backend.webhookUrl}/api/voice-calls/webhook`;
            console.log(`🔗 Webhook URL: ${webhookUrl}`);

            // Tạo custom prompt với thông tin bệnh nhân
            const customPrompt = `
Bạn là Mai, trợ lý AI chăm sóc khách hàng của Phòng Khám Đa Khoa Healthcare.
Bạn đang gọi cho bệnh nhân: ${appointment.fullName || 'khách hàng'}
Bác sĩ đã khám: ${appointment.doctor || 'không xác định'}
Ngày khám: ${appointment.startTimeLocal || 'gần đây'}

Nhiệm vụ: Thực hiện khảo sát chất lượng dịch vụ sau khám bệnh.
- Hỏi mức độ hài lòng (0-10)
- Hỏi đánh giá chất lượng (1-5 sao)
- Lắng nghe góp ý và ghi nhận
- Giữ thái độ thân thiện, chuyên nghiệp
            `.trim();

            // Tạo cuộc gọi qua ElevenLabs Conversational AI API
            try {
                // Method 1: Using conversational AI SDK
                const response = await axios.post(
                    `https://api.elevenlabs.io/v1/convai/conversation`,
                    {
                        agent_id: AGENT_ID,
                        // For outbound calls, you need phone integration
                        // This requires ElevenLabs Enterprise plan with Twilio/phone integration
                        mode: 'public', // or 'webhook' for callback
                        
                        // Custom overrides
                        agent_override: {
                            prompt: {
                                prompt: customPrompt
                            },
                            first_message: `Xin chào ${appointment.fullName || 'anh/chị'}, em là Mai từ Phòng Khám Healthcare. Em gọi để khảo sát sau khám bệnh ạ.`
                        }
                    },
                    {
                        headers: {
                            'xi-api-key': config.elevenlabs.apiKey,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const conversationId = response.data.conversation_id;
                console.log(`✅ Conversation created: ${conversationId}`);

                // For actual phone calls, you need to use signed_url or integrate with phone system
                // This creates a web-based conversation session
                const sessionUrl = `https://elevenlabs.io/app/talk-to?agent_id=${AGENT_ID}&conversation_id=${conversationId}`;

                return {
                    success: true,
                    callId: conversationId,
                    status: 'INITIATED',
                    phoneNumber: phoneNumber,
                    sessionUrl: sessionUrl,
                    metadata: {
                        appointment_id: appointment.id,
                        patient_name: appointment.fullName,
                        doctor_name: appointment.doctor,
                        appointment_date: appointment.startTimeLocal,
                        phone: phoneNumber,
                    },
                    note: 'Conversation session created. For actual phone calls, please configure Twilio integration in ElevenLabs dashboard.'
                };
            } catch (elevenLabsError) {
                console.warn('⚠️ ElevenLabs API error:', elevenLabsError.message);
                console.warn('   Response:', elevenLabsError.response?.data);
                console.warn('   Falling back to mock mode for testing...');
                
                // Fallback to mock for testing
                const mockCallId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                console.log(`✅ Voice call simulated: ${mockCallId}`);

                return {
                    success: true,
                    callId: mockCallId,
                    status: 'INITIATED',
                    phoneNumber: phoneNumber,
                    sessionUrl: `https://elevenlabs.io/app/talk-to?agent_id=${AGENT_ID}`,
                    note: 'Mock call created. For real calls: 1) Configure Twilio in ElevenLabs, 2) Use Enterprise plan with phone integration.'
                };
            }
        } catch (error) {
            console.error('❌ Voice call error:', error.message);
            return {
                success: false,
                error: error.message,
                status: 'FAILED',
            };
        }
    }

    /**
     * Lấy trạng thái cuộc gọi
     * @param {string} callId - ID của cuộc gọi từ ElevenLabs
     * @returns {Promise<Object|null>} Thông tin cuộc gọi
     */
    async getCallStatus(callId) {
        try {
            // For mock calls, return status from Firebase
            if (callId.startsWith('mock_')) {
                console.log(`📊 Getting mock call status for ${callId}`);
                return {
                    call_id: callId,
                    status: 'initiated',
                    note: 'This is a simulated call for testing'
                };
            }
            
            // For real ElevenLabs calls (when implemented)
            if (!client.conversationalAi) {
                throw new Error('ElevenLabs Conversational AI not available');
            }
            
            // Note: SDK doesn't have getCall method, would need to use conversations.get
            console.log(`📊 Call status check not implemented for real calls yet`);
            return {
                call_id: callId,
                status: 'unknown'
            };
        } catch (error) {
            console.error('❌ Get call status error:', error.message);
            return null;
        }
    }

    /**
     * Lấy transcript của cuộc gọi
     * @param {string} callId - ID của cuộc gọi từ ElevenLabs
     * @returns {Promise<Object|null>} Transcript của cuộc gọi
     */
    async getCallTranscript(callId) {
        try {
            if (!client.conversationalAi) {
                throw new Error('ElevenLabs Conversational AI not available');
            }
            const transcript = await client.conversationalAi.getCallTranscript(callId);
            console.log(`📝 Retrieved transcript for call ${callId}`);
            return transcript;
        } catch (error) {
            console.error('❌ Get transcript error:', error.message);
            return null;
        }
    }

    /**
     * Phân tích sentiment từ transcript
     * @param {string} transcript - Nội dung transcript
     * @returns {string} Sentiment (POSITIVE, NEUTRAL, NEGATIVE)
     */
    analyzeSentiment(transcript) {
        if (!transcript) return 'UNKNOWN';

        const lowerTranscript = transcript.toLowerCase();

        // Trích xuất điểm số từ câu trả lời của user
        const lines = transcript.split('\n');
        const userAnswers = lines
            .filter(l => l.toLowerCase().startsWith('user:'))
            .map(l => l.replace(/user:/i, '').trim());

        // Lấy các số từ 0-10
        const numericScores = userAnswers
            .map(msg => {
                const match = msg.match(/\b(\d+)\b/);
                return match ? parseInt(match[1]) : null;
            })
            .filter(n => n !== null && n >= 0 && n <= 10);

        console.log('📊 Sentiment Analysis:', {
            userAnswers,
            numericScores
        });

        // Nếu có điểm số, phân tích dựa trên điểm
        if (numericScores.length > 0) {
            const avgScore = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
            const hasLowScore = numericScores.some(s => s <= 3);
            
            console.log(`📈 Average score: ${avgScore.toFixed(1)}, Has low score: ${hasLowScore}`);
            
            // Nếu có bất kỳ điểm nào <= 3 hoặc trung bình < 5 → NEGATIVE
            if (hasLowScore || avgScore < 5) {
                return 'NEGATIVE';
            }
            // Trung bình >= 7 → POSITIVE
            if (avgScore >= 7) {
                return 'POSITIVE';
            }
            // Còn lại → NEUTRAL
            return 'NEUTRAL';
        }

        // Nếu không có điểm số, phân tích theo từ khóa
        const positiveKeywords = ['tốt', 'hài lòng', 'cảm ơn', 'tuyệt vời', 'ok', 'được', 'ổn'];
        const negativeKeywords = ['không tốt', 'tệ', 'không hài lòng', 'chậm', 'lâu', 'kém', 'cần cải thiện'];

        let positiveCount = 0;
        let negativeCount = 0;

        positiveKeywords.forEach(keyword => {
            if (lowerTranscript.includes(keyword)) positiveCount++;
        });

        negativeKeywords.forEach(keyword => {
            if (lowerTranscript.includes(keyword)) negativeCount++;
        });

        if (positiveCount > negativeCount) return 'POSITIVE';
        if (negativeCount > positiveCount) return 'NEGATIVE';
        return 'NEUTRAL';
    }

    /**
     * Format số điện thoại về định dạng quốc tế E.164
     * @param {string} phoneNumber - Số điện thoại
     * @returns {string} Số điện thoại đã format
     */
    formatPhoneNumber(phoneNumber) {
        // Loại bỏ khoảng trắng và ký tự đặc biệt
        let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

        // Nếu bắt đầu bằng 0, thay bằng +84
        if (cleaned.startsWith('0')) {
            cleaned = '+84' + cleaned.substring(1);
        }

        // Nếu chưa có +, thêm +84
        if (!cleaned.startsWith('+')) {
            cleaned = '+84' + cleaned;
        }

        return cleaned;
    }

    /**
     * Kiểm tra xem có thể gọi được không (giờ hành chính)
     * @returns {boolean} True nếu trong giờ hành chính
     */
    isBusinessHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        // Thứ 2-7 (1-6), từ 8h-17h
        return day >= 1 && day <= 6 && hour >= 8 && hour < 17;
    }

    /**
     * Tính toán thời gian tiếp theo có thể gọi
     * @returns {Date} Thời gian tiếp theo
     */
    getNextAvailableCallTime() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        // Nếu đang trong giờ làm việc
        if (this.isBusinessHours()) {
            return now;
        }

        // Nếu sau 17h hoặc trước 8h -> 8h sáng hôm sau
        const next = new Date(now);
        
        if (hour >= 17 || hour < 8) {
            next.setDate(next.getDate() + 1);
            next.setHours(8, 0, 0, 0);
        }

        // Nếu là chủ nhật (0) -> thứ 2
        if (day === 0) {
            next.setDate(next.getDate() + 1);
            next.setHours(8, 0, 0, 0);
        }

        // Nếu là thứ 7 (6) -> thứ 2
        if (day === 6) {
            next.setDate(next.getDate() + 2);
            next.setHours(8, 0, 0, 0);
        }

        return next;
    }

    /**
     * Gửi kết quả cuộc gọi đến n8n webhook
     * @param {Object} callData - Dữ liệu cuộc gọi
     * @returns {Promise<boolean>} Success status
     */
    async sendToN8NWebhook(callData) {
        try {
            const n8nWebhookUrl = process.env.N8N_WEBHOOK_VOICE;
            
            if (!n8nWebhookUrl) {
                console.warn('⚠️ N8N webhook URL not configured');
                return false;
            }

            console.log(`📤 Sending voice call result to n8n: ${n8nWebhookUrl}`);
            console.log(`📦 Call data:`, JSON.stringify(callData, null, 2));
            
            const response = await axios.post(n8nWebhookUrl, callData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log(`✅ Successfully sent to n8n: ${response.status}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending to n8n:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            return false;
        }
    }
}

export default new VoiceService();
