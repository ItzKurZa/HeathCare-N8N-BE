import axios from 'axios';
import { config } from '../../config/env.js';

class AIAnalyzer {
    /**
     * Phân tích phản hồi khảo sát và đưa ra gợi ý xử lý
     * @param {Object} surveyData - Dữ liệu khảo sát
     * @returns {Promise<string>} Phân tích từ AI
     */
    async analyze(surveyData) {
        try {
            if (!config.openrouter.apiKey) {
                console.warn('⚠️ OpenRouter API Key not configured, using fallback analysis');
                return this.fallbackAnalysis(surveyData);
            }

            const prompt = this.buildPrompt(surveyData);

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: 'openai/gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'Bạn là chuyên gia CSKH y tế, phân tích phản hồi khách hàng và đưa ra hành động cụ thể, thực tế.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.openrouter.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': config.frontendUrl || 'https://healthcare-app.com',
                        'X-Title': 'Healthcare CSKH System'
                    },
                    timeout: 30000
                }
            );

            const analysis = response.data.choices[0].message.content;
            console.log('✅ AI analysis completed');
            return analysis;

        } catch (error) {
            console.error('❌ AI analysis error:', error.response?.data || error.message);
            return this.fallbackAnalysis(surveyData);
        }
    }

    /**
     * Xây dựng prompt cho AI
     * @param {Object} surveyData 
     * @returns {string} Prompt
     */
    buildPrompt(surveyData) {
        return `
Bạn là chuyên gia CSKH, phân tích phản hồi khách hàng và đưa ra hành động cụ thể. Trả lời NGẮN GỌN (≤180 từ), rõ ràng, dễ thực hiện.

DỮ LIỆU KHÁCH HÀNG:
- Họ tên: ${surveyData.patientName}
- SĐT: ${surveyData.phone}
- Điểm TB (0-10): ${surveyData.overall_score?.toFixed(1) || 'N/A'}
- NPS: ${surveyData.nps}/10
- CSAT: ${surveyData.csat}/5
- Cơ sở vật chất: ${surveyData.facility}/5
- Thái độ Bác sĩ: ${surveyData.staff_doctor || 'Không đánh giá'}
- Thái độ Lễ tân: ${surveyData.staff_reception || 'Không đánh giá'}
- Thái độ Điều dưỡng: ${surveyData.staff_nurse || 'Không đánh giá'}
- Thời gian chờ: ${surveyData.waiting_time || 'Không đánh giá'}
- Góp ý: ${surveyData.comment || 'Không có'}

YÊU CẦU (100% tiếng Việt, format gạch đầu dòng):

1. VẤN ĐỀ CHÍNH:
(Tóm tắt 1-2 câu ngắn gọn. Nếu không rõ → ghi "Chưa rõ vấn đề")

2. HÀNH ĐỘNG KHẮC PHỤC: (3 điểm cụ thể)
- [Người chịu trách nhiệm] - [Hành động cụ thể] - [Thời hạn]
- [Người chịu trách nhiệm] - [Hành động cụ thể] - [Thời hạn]
- [Người chịu trách nhiệm] - [Hành động cụ thể] - [Thời hạn]

3. MẪU THOẠI:
📞 Gọi điện: (2-3 câu ngắn gọn, thân thiện)
💬 Nhắn tin: (2-3 câu ngắn gọn, lịch sự)

QUAN TRỌNG:
- Ngắn gọn, dễ hiểu, dễ thực hiện
- Tập trung vào giải pháp, không phân tích dài dòng
- Sử dụng format markdown rõ ràng
`;
    }

    /**
     * Phân tích dự phòng khi AI không khả dụng
     * @param {Object} surveyData 
     * @returns {string} Phân tích cơ bản
     */
    fallbackAnalysis(surveyData) {
        const issues = [];
        const actions = [];

        // Phân tích điểm số
        if (surveyData.nps < 7) {
            issues.push('NPS thấp (' + surveyData.nps + '/10)');
            actions.push('Trưởng CSKH - Gọi điện xin lỗi và lắng nghe phản hồi - Trong 4h');
        }

        if (surveyData.csat < 3) {
            issues.push('Độ hài lòng thấp');
            actions.push('Quản lý PK - Kiểm tra quy trình phục vụ - Trong 24h');
        }

        if (surveyData.facility < 3) {
            issues.push('Cơ sở vật chất chưa tốt');
            actions.push('Bộ phận Kỹ thuật - Kiểm tra và nâng cấp cơ sở vật chất - Trong 48h');
        }

        // Phân tích thái độ nhân viên
        const staffIssues = [];
        if (surveyData.staff_doctor?.includes('Không hài lòng')) {
            staffIssues.push('bác sĩ');
        }
        if (surveyData.staff_reception?.includes('Không hài lòng')) {
            staffIssues.push('lễ tân');
        }
        if (surveyData.staff_nurse?.includes('Không hài lòng')) {
            staffIssues.push('điều dưỡng');
        }

        if (staffIssues.length > 0) {
            issues.push('Thái độ nhân viên: ' + staffIssues.join(', '));
            actions.push('Trưởng khoa - Đào tạo lại về kỹ năng giao tiếp - Trong tuần');
        }

        // Thời gian chờ
        if (surveyData.waiting_time?.includes('Quá lâu')) {
            issues.push('Thời gian chờ quá lâu');
            actions.push('Lễ tân trưởng - Tối ưu lịch hẹn và quy trình tiếp nhận - Trong 24h');
        }

        // Xây dựng phân tích
        let analysis = '## 1. VẤN ĐỀ CHÍNH:\n\n';
        if (issues.length > 0) {
            analysis += issues.join(', ') + '\n\n';
        } else {
            analysis += 'Điểm số thấp nhưng chưa rõ nguyên nhân cụ thể. Cần gọi điện xác minh.\n\n';
        }

        analysis += '## 2. HÀNH ĐỘNG KHẮC PHỤC:\n\n';
        if (actions.length > 0) {
            actions.forEach(action => {
                analysis += `- ${action}\n`;
            });
        } else {
            analysis += '- CSKH - Gọi điện tìm hiểu chi tiết vấn đề - Trong 4h\n';
            analysis += '- Quản lý PK - Họp nội bộ phân tích và đưa ra giải pháp - Trong 24h\n';
            analysis += '- CSKH - Gọi lại khách hàng thông báo kết quả xử lý - Trong 48h\n';
        }

        analysis += '\n## 3. MẪU THOẠI:\n\n';
        analysis += `📞 **Gọi điện:**\n`;
        analysis += `"Chào anh/chị ${surveyData.patientName}. Em là nhân viên CSKH từ Phòng Khám. `;
        analysis += `Em nhận được phản hồi của anh/chị và rất xin lỗi về trải nghiệm chưa tốt. `;
        analysis += `Anh/chị có thể chia sẻ thêm để chúng em cải thiện được không ạ?"\n\n`;

        analysis += `💬 **Nhắn tin:**\n`;
        analysis += `"Kính chào anh/chị ${surveyData.patientName}. Phòng Khám xin lỗi về trải nghiệm chưa tốt của anh/chị. `;
        analysis += `Chúng em đã ghi nhận và sẽ liên hệ trong 24h để hỗ trợ. Trân trọng!"`;

        return analysis;
    }

    /**
     * Phân tích transcript từ voice call
     * @param {string} transcript - Nội dung transcript
     * @returns {Object} Kết quả phân tích
     */
    analyzeTranscript(transcript) {
        const analysis = {
            sentiment: 'NEUTRAL',
            keyPoints: [],
            actionRequired: false,
            summary: ''
        };

        if (!transcript) {
            return analysis;
        }

        const lowerTranscript = transcript.toLowerCase();

        // Phân tích sentiment
        const positiveWords = ['tốt', 'hài lòng', 'cảm ơn', 'ok', 'được', 'tuyệt'];
        const negativeWords = ['không tốt', 'tệ', 'không hài lòng', 'chậm', 'kém'];

        let positiveCount = 0;
        let negativeCount = 0;

        positiveWords.forEach(word => {
            if (lowerTranscript.includes(word)) positiveCount++;
        });
        negativeWords.forEach(word => {
            if (lowerTranscript.includes(word)) negativeCount++;
        });

        if (positiveCount > negativeCount) {
            analysis.sentiment = 'POSITIVE';
        } else if (negativeCount > positiveCount) {
            analysis.sentiment = 'NEGATIVE';
            analysis.actionRequired = true;
        }

        // Tóm tắt
        analysis.summary = transcript.length > 200 
            ? transcript.substring(0, 200) + '...' 
            : transcript;

        return analysis;
    }
}

export default new AIAnalyzer();
