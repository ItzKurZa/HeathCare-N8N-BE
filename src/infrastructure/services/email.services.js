import sgMail from '@sendgrid/mail';
import { config } from '../../config/env.js';

sgMail.setApiKey(config.sendgrid.apiKey);

class EmailService {
    /**
     * Gửi email khảo sát cho bệnh nhân
     * @param {Object} appointment - Thông tin appointment
     * @param {string} surveyUrl - URL của biểu mẫu khảo sát
     */
    async sendSurvey(appointment, surveyUrl) {
        console.log(appointment.email, appointment.fullName, appointment.doctor, appointment.startTimeLocal, surveyUrl);
        const msg = {
            to: appointment.email,
            from: config.sendgrid.senderEmail,
            subject: `Khảo sát hài lòng sau khám – ${appointment.fullName}`,
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px;">
                    <div style="background:#007bff;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
                        <h2 style="margin:0;">Khảo Sát Hài Lòng</h2>
                    </div>
                    
                    <div style="padding:20px;">
                        <p>Chào <b>${appointment.fullName}</b>,</p>
                        
                        <p>Cảm ơn Anh/Chị đã thăm khám với <b>${appointment.doctor}</b> vào ngày <b>${appointment.startTimeLocal}</b>.</p>
                        
                        <p>Chúng tôi rất mong nhận được phản hồi của Anh/Chị để cải thiện chất lượng dịch vụ.</p>
                        
                        <p>Vui lòng dành 30 giây để đánh giá:</p>
                        
                        <div style="text-align:center;margin:30px 0;">
                            <a href="${surveyUrl}" 
                               style="display:inline-block;padding:15px 30px;background:#007bff;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
                                📋 Mở Biểu Mẫu Khảo Sát
                            </a>
                        </div>
                        
                        <p style="color:#666;font-size:14px;">Thời gian hoàn thành: Chỉ 30 giây</p>
                        
                        <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;">
                        
                        <p style="color:#666;font-size:13px;">
                            Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ:<br>
                            📞 Hotline: 1900-xxxx<br>
                            ✉️ Email: ${config.sendgrid.cskhEmail}
                        </p>
                        
                        <p style="margin-top:20px;">Trân trọng cảm ơn!</p>
                        <p style="font-weight:bold;">Phòng Khám Healthcare</p>
                    </div>
                </div>
            `
        };

        try {
            await sgMail.send(msg);
            console.log(`✅ Survey email sent to ${appointment.email}`);
            return { success: true };
        } catch (error) {
            console.error('❌ SendGrid survey error:', error.response?.body || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Gửi email cảnh báo cho CSKH khi có phản hồi tiêu cực
     * @param {Object} surveyData - Dữ liệu khảo sát
     * @param {string} aiAnalysis - Phân tích từ AI
     */
    async sendAlert(surveyData, aiAnalysis) {
        const msg = {
            to: config.sendgrid.cskhEmail,
            from: config.sendgrid.senderEmail,
            subject: `[CSKH] ⚠️ Cảnh báo phản hồi - ${surveyData.patientName} / NPS: ${surveyData.nps}`,
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;">
                    <div style="background:#d9534f;color:white;padding:20px;border-radius:8px 8px 0 0;">
                        <h2 style="margin:0;">🚨 CẢNH BÁO KHÁCH HÀNG KHÔNG HÀI LÒNG 🚨</h2>
                    </div>
                    
                    <div style="padding:20px;background:#fff3cd;border-left:4px solid #d9534f;">
                        <h3 style="color:#d9534f;margin-top:0;">👤 Thông tin khách hàng</h3>
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Họ tên:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.patientName}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>SĐT:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.phone}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Mã booking:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.appointmentId}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Thời gian gửi:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(surveyData.submittedAt).toLocaleString('vi-VN')}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="padding:20px;background:white;margin-top:20px;border:1px solid #e0e0e0;border-radius:8px;">
                        <h3 style="color:#d9534f;margin-top:0;">📊 Điểm số đánh giá</h3>
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;width:40%;"><b>NPS (Net Promoter Score):</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:18px;color:${surveyData.nps < 7 ? '#d9534f' : '#5cb85c'};">
                                    <b>${surveyData.nps}/10</b>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>CSAT (Customer Satisfaction):</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:18px;">${surveyData.csat}/5</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Cơ sở vật chất:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.facility}/5</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Thái độ Bác sĩ:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.staff_doctor || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Thái độ Lễ tân:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.staff_reception || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Thái độ Điều dưỡng:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.staff_nurse || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Thời gian chờ:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${surveyData.waiting_time || 'N/A'}</td>
                            </tr>
                            <tr style="background:#f9f9f9;">
                                <td style="padding:8px;"><b>Tổng điểm trung bình:</b></td>
                                <td style="padding:8px;font-size:20px;font-weight:bold;color:${surveyData.overall_score < 7 ? '#d9534f' : '#5cb85c'};">
                                    ${surveyData.overall_score.toFixed(1)}/10
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    ${surveyData.comment ? `
                    <div style="padding:20px;background:#f9f9f9;margin-top:20px;border-left:4px solid #f0ad4e;border-radius:4px;">
                        <h3 style="margin-top:0;">💬 Nhận xét của khách hàng</h3>
                        <p style="font-size:16px;font-style:italic;">"${surveyData.comment}"</p>
                    </div>
                    ` : ''}
                    
                    <div style="padding:20px;background:#e3f2fd;margin-top:20px;border-left:4px solid #2196f3;border-radius:4px;">
                        <h3 style="margin-top:0;color:#1976d2;">🤖 Phân tích & Gợi ý xử lý (AI)</h3>
                        <pre style="background:white;padding:15px;border-radius:4px;font-family:monospace;white-space:pre-wrap;border:1px solid #90caf9;">${aiAnalysis}</pre>
                    </div>
                    
                    <div style="padding:20px;background:#d9534f;color:white;margin-top:20px;border-radius:8px;text-align:center;">
                        <p style="margin:0;font-size:18px;font-weight:bold;">
                            👉 Bộ phận CSKH vui lòng xử lý ngay trong 24h
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await sgMail.send(msg);
            console.log(`✅ Alert email sent to CSKH`);
            return { success: true };
        } catch (error) {
            console.error('❌ SendGrid alert error:', error.response?.body || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Gửi email reminder cho appointment sắp tới
     * @param {Object} appointment - Thông tin appointment
     */
    async sendAppointmentReminder(appointment) {
        const msg = {
            to: appointment.email,
            from: config.sendgrid.senderEmail,
            subject: `Nhắc lịch khám – ${appointment.fullName}`,
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
                    <h2 style="color:#007bff;">📅 Nhắc Lịch Khám</h2>
                    <p>Chào <b>${appointment.fullName}</b>,</p>
                    <p>Đây là lời nhắc về lịch khám của Anh/Chị:</p>
                    
                    <div style="background:#f8f9fa;padding:15px;border-left:4px solid #007bff;margin:20px 0;">
                        <p><b>Bác sĩ:</b> ${appointment.doctor}</p>
                        <p><b>Thời gian:</b> ${appointment.startTimeLocal}</p>
                        <p><b>SĐT liên hệ:</b> ${appointment.phone}</p>
                    </div>
                    
                    <p>Vui lòng đến đúng giờ. Nếu có thay đổi, vui lòng liên hệ: <b>1900-xxxx</b></p>
                    <p>Trân trọng!</p>
                </div>
            `
        };

        try {
            await sgMail.send(msg);
            console.log(`✅ Reminder email sent to ${appointment.email}`);
            return { success: true };
        } catch (error) {
            console.error('❌ SendGrid reminder error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Gửi email cảnh báo cho CSKH khi có phản hồi tiêu cực từ cuộc gọi voice
     * @param {Object} appointment - Thông tin appointment
     * @param {Object} insights - Phân tích từ cuộc gọi
     * @param {string} transcript - Nội dung cuộc gọi
     */
    async sendVoiceCallAlert(appointment, insights, transcript) {
        const msg = {
            to: config.sendgrid.cskhEmail,
            from: config.sendgrid.senderEmail,
            subject: `[VOICE] 📞 Cảnh báo - ${appointment.fullName} - ${insights.sentiment}`,
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;">
                    <div style="background:#ff6b6b;color:white;padding:20px;border-radius:8px 8px 0 0;">
                        <h2 style="margin:0;">📞 CẢNH BÁO PHẢN HỒI TIÊU CỰC QUA CUỘC GỌI</h2>
                    </div>
                    
                    <div style="padding:20px;background:#fff3cd;border-left:4px solid #ff6b6b;">
                        <h3 style="color:#ff6b6b;margin-top:0;">👤 Thông tin khách hàng</h3>
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;width:30%;"><b>Họ tên:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${appointment.fullName}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Số điện thoại:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${appointment.phone}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Email:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${appointment.email || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Bác sĩ khám:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${appointment.doctor}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Thời gian khám:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${appointment.startTimeLocal}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="padding:20px;background:white;margin-top:20px;border:1px solid #e0e0e0;border-radius:8px;">
                        <h3 style="color:#ff6b6b;margin-top:0;">📊 Phân tích cuộc gọi</h3>
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;width:40%;"><b>Cảm xúc tổng thể:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">
                                    <span style="display:inline-block;padding:4px 12px;background:${
                                        insights.sentiment === 'negative' ? '#d9534f' :
                                        insights.sentiment === 'neutral' ? '#f0ad4e' : '#5cb85c'
                                    };color:white;border-radius:4px;font-weight:bold;">
                                        ${insights.sentiment?.toUpperCase() || 'N/A'}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Mức độ hài lòng:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${insights.satisfaction_level || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Điểm NPS (ước tính):</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:18px;font-weight:bold;">
                                    ${insights.nps_score ? `${insights.nps_score}/10` : 'N/A'}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Vấn đề phát hiện:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">
                                    ${insights.concerns && insights.concerns.length > 0 
                                        ? insights.concerns.map(c => `<span style="display:inline-block;padding:2px 8px;background:#f0ad4e;color:white;border-radius:3px;margin:2px;">${c}</span>`).join(' ')
                                        : 'Không xác định'}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;"><b>Điểm tích cực:</b></td>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">
                                    ${insights.positives && insights.positives.length > 0 
                                        ? insights.positives.join(', ')
                                        : 'Không có'}
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="padding:20px;background:#e9ecef;margin-top:20px;border-left:4px solid #6c757d;border-radius:4px;">
                        <h3 style="margin-top:0;color:#495057;">📝 Transcript cuộc gọi</h3>
                        <div style="background:white;padding:15px;border-radius:4px;max-height:400px;overflow-y:auto;font-family:monospace;font-size:14px;line-height:1.8;white-space:pre-wrap;">${transcript}</div>
                    </div>
                    
                    ${insights.recommendations ? `
                    <div style="padding:20px;background:#e3f2fd;margin-top:20px;border-left:4px solid #2196f3;border-radius:4px;">
                        <h3 style="margin-top:0;color:#1976d2;">💡 Gợi ý xử lý</h3>
                        <ul style="line-height:1.8;">
                            ${insights.recommendations.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    <div style="padding:20px;background:#ff6b6b;color:white;margin-top:20px;border-radius:8px;text-align:center;">
                        <p style="margin:0;font-size:18px;font-weight:bold;">
                            👉 Vui lòng liên hệ khách hàng trong vòng 4 giờ!
                        </p>
                    </div>
                    
                    <div style="padding:15px;background:#f8f9fa;margin-top:20px;border-radius:4px;text-align:center;color:#666;font-size:13px;">
                        <p style="margin:0;">Email tự động từ Healthcare Voice AI System</p>
                        <p style="margin:5px 0 0 0;">Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
                    </div>
                </div>
            `
        };

        try {
            await sgMail.send(msg);
            console.log(`✅ Voice call alert email sent to CSKH for ${appointment.fullName}`);
            return { success: true };
        } catch (error) {
            console.error('❌ SendGrid voice alert error:', error.response?.body || error.message);
            return { success: false, error: error.message };
        }
    }
}

export default new EmailService();
