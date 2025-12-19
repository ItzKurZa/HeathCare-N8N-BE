import { updateBookingInFirestore, getBookingsByUserId } from '../../infrastructure/services/firebase.services.js';

export const cancelBookingUsecase = async (bookingId, userId) => {
    if (!bookingId) {
        throw new Error("Booking ID is required");
    }

    // Logic kiểm tra chủ sở hữu vẫn giữ nguyên. 
    // Hàm getBookingsByUserId (đã sửa ở bước trước) sẽ lấy đúng danh sách trong sub-collection của user này.
    const userBookings = await getBookingsByUserId(userId);
    const isOwner = userBookings.some(b => b.id === bookingId);
    if (!isOwner) throw new Error("Unauthorized access to booking");

    const updateData = {
        status: 'cancelled',
        updatedAt: new Date(),
        updatedBy: userId
    };

    // [THAY ĐỔI] Truyền userId làm tham số thứ 3 để Service biết tìm booking ở đâu
    const result = await updateBookingInFirestore(bookingId, updateData, userId);
    return result;
};