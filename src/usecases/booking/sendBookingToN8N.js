// import { sendBooking } from '../../infrastructure/services/n8n.services.js';
import { createBookingInFirestore } from '../../infrastructure/services/firebase.services.js'; // Import hàm mới
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8n = async (bookingData) => {
    const requiredFields = ['cccd', 'department', 'appointment_date'];
    requireFields(bookingData, requiredFields);

    const payload = { 
        ...bookingData,
        created_at: Date.now() 
    };

    const savedBooking = await createBookingInFirestore(payload);

    // const payload = { 
    //     ...savedBooking,
    //     booking_id: savedBooking.id,
    //     created_at: Date.now() 
    // };

    // try {
    //     await sendBooking(payload);
    // } catch (error) {
    //     console.error("Gửi N8N thất bại, nhưng data đã lưu DB:", error);
    // }

    return savedBooking;
};