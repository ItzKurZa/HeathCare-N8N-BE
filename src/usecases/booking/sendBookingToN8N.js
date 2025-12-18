import { sendBooking } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8N = async (bookingData) => {
    const requiredFields = ['userId'];

    requireFields(bookingData, requiredFields);

    const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5002';
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const callbackUrl = `${backendUrl}/api/webhook/n8n/booking`;

    // Sử dụng submissionId làm mã đặt lịch (6 ký tự chữ và số) thay vì UUID
    const bookingCode = bookingData.submissionId || bookingData.submission_id || bookingData.id;
    const checkInUrl = bookingData.checkInUrl || `${frontendUrl}/check-in/${bookingCode}`;
    const backendUrlForAssets = process.env.BACKEND_URL || backendUrl;
    const logoUrl = bookingData.logoUrl || process.env.LOGO_URL || `${backendUrlForAssets}/api/assets/logo`;

    const payload = { 
        ...bookingData,
        // Mã đặt lịch chính - N8N template nên sử dụng field này thay vì 'id'
        bookingCode: bookingCode,
        maDatLich: bookingCode, // Tên tiếng Việt để dễ nhận biết trong N8N template
        submissionId: bookingData.submissionId || bookingData.submission_id, // Đảm bảo submissionId có trong payload
        // Lưu ý: 'id' vẫn giữ UUID để backward compatibility, nhưng không nên dùng trong email template
        created_At: Date.now(),
        callbackUrl,
        checkInUrl,
        logoUrl,
    };

    const result = await sendBooking(payload);
    return result;
};