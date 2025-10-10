import { sendBooking } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8n = async (bookingData) => {
    requireFields(bookingData);

    const payload = { ...bookingData, createdAt: Date.now() };

    const result = await sendBooking(payload);
    return result;
};