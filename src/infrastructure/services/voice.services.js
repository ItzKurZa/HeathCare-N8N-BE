import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from '../../config/env.js';

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

            // Tạo context cho Voice Agent
            const callContext = {
                patient_name: appointment.fullName,
                doctor_name: appointment.doctor,
                appointment_date: appointment.startTimeLocal,
                appointment_id: appointment.id,
            };

            console.log(`📞 Initiating voice call to ${appointment.phone}...`);

            // Note: ElevenLabs Conversational AI v2 doesn't support direct phone calls via SDK
            // You need to use their dashboard to set up phone numbers or use webhooks
            // For now, we'll simulate the call initiation
            
            console.warn('⚠️  Note: Direct phone calls require ElevenLabs phone number setup');
            console.warn('   Please configure phone number in ElevenLabs dashboard');
            console.warn('   Or use widget/link integration instead');
            
            // Generate a mock call ID for testing
            const mockCallId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            
            console.log(`✅ Voice call simulated: ${mockCallId}`);

            return {
                success: true,
                callId: mockCallId,
                status: 'INITIATED',
                phoneNumber: appointment.phone,
                note: 'This is a simulated call. Configure ElevenLabs phone integration for real calls.'
            };
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

        // Từ khóa tích cực
        const positiveKeywords = ['tốt', 'hài lòng', 'cảm ơn', 'tuyệt vời', 'ok', 'được', 'ổn'];
        // Từ khóa tiêu cực
        const negativeKeywords = ['không tốt', 'tệ', 'không hài lòng', 'chậm', 'lâu', 'kém'];

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
}

export default new VoiceService();
