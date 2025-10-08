import { sendBooking } from '../../infrastructure/services/n8n.service.js';
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8n = async (bookingData) => {
    // Basic validation
    requireFields(bookingData, ['userId', 'date', 'service']);

    // Map/transform nếu cần (ví dụ thêm timestamp)
    const payload = { ...bookingData, createdAt: Date.now() };

    const result = await sendBooking(payload);
    return result;
};