import { sendBooking } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8N = async (bookingData) => {
    const requiredFields = ['userId'];

    requireFields(bookingData, requiredFields);

    const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5002';
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const callbackUrl = `${backendUrl}/api/webhook/n8n/booking`;
    const bookingCode = bookingData.submissionId || bookingData.submission_id || bookingData.id;
    const bookingUrl = bookingData.bookingUrl || `${frontendUrl}/booking/${bookingCode}`;
    const checkInUrl = bookingData.checkInUrl || `${frontendUrl}/check-in/${bookingCode}`;
    const backendUrlForAssets = process.env.BACKEND_URL || backendUrl;
    const logoUrl = bookingData.logoUrl || process.env.LOGO_URL || `${backendUrlForAssets}/api/assets/logo`;

    const payload = { 
        ...bookingData,
        bookingCode: bookingCode,
        maDatLich: bookingCode, 
        bookingUrl: bookingUrl,
        submissionId: bookingData.submissionId || bookingData.submission_id, 
        created_At: Date.now(),
        callbackUrl,
        checkInUrl,
        logoUrl,
    };

    const result = await sendBooking(payload);
    return result;
};