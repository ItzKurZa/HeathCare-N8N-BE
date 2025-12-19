import { sendBooking } from '../../infrastructure/services/n8n.services.js';
import { createBookingInFirestore } from '../../infrastructure/services/firebase.services.js'; // Import hàm mới
import { requireFields } from '../../utils/validate.js';

export const sendBookingToN8n = async (bookingData) => {
    const requiredFields = ['user_id', 'department', 'appointment_date', 'reason']; // Kiểm tra kỹ hơn các trường quan trọng
    requireFields(bookingData, requiredFields);

    // 1. Lưu vào Database trước (An toàn dữ liệu)
    const savedBooking = await createBookingInFirestore(bookingData);

    // 2. Chuẩn bị payload gửi N8N (kèm theo Booking ID để N8N biết mà cập nhật lại)
    const payload = { 
        ...savedBooking,
        booking_id: savedBooking.id, // Rất quan trọng: gửi ID này sang N8N
        created_at: Date.now() 
    };

    // 3. Gửi sang N8N (Fire-and-forget hoặc chờ kết quả tùy logic N8N của bạn)
    // Ở đây ta cứ gửi đi, N8N sẽ xử lý sau.
    try {
        await sendBooking(payload);
    } catch (error) {
        console.error("Gửi N8N thất bại, nhưng data đã lưu DB:", error);
        // Không throw lỗi để Frontend vẫn nhận được báo cáo thành công là đã lưu lịch
    }

    return savedBooking;
};