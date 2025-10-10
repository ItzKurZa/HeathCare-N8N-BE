import { sendBooking } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8n = async (bookingData) => {
    const requiredFields = ['user_id'];

    requireFields(bookingData, requiredFields);

    const payload = { ...bookingData, created_At: Date.now() };

    const result = await sendBooking(payload);
    return result;
};