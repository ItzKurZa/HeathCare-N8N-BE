// src/usecases/booking/getBookings.js
import { getAllBookingsFromFirestore, getUserProfile } from '../../infrastructure/services/firebase.services.js';

export const getBookings = async (uid) => {
    // 1. Lấy thông tin chi tiết của người dùng đang đăng nhập để biết Role, Department, Tên
    // Lưu ý: getUserProfile trong code cũ của bạn chỉ query bảng 'users'. 
    // Nếu admin nằm bảng 'admins' hoặc doctor nằm bảng 'departments', bạn cần đảm bảo getUserProfile lấy đúng.
    // Tạm thời giả định hàm getUserProfile lấy được data hoặc bạn cần cập nhật nó.
    
    // Logic fallback đơn giản nếu getUserProfile chỉ tìm trong 'users':
    // Chúng ta sẽ cần query thêm nếu không tìm thấy, nhưng ở đây tôi sẽ dùng logic filter cơ bản.
    
    const userProfile = await getUserProfile(uid); 
    // Nếu getUserProfile trả về null (do user nằm ở collection khác), ta có thể cần check bảng admin/staff
    // Ở đây tôi giả sử hệ thống đã lưu Role vào Custom Claims hoặc userProfile lấy được hết.

    if (!userProfile) {
         // Nếu không tìm thấy profile, trả về rỗng hoặc mặc định
         return [];
    }

    const { role, department, name, fullname } = userProfile;
    const doctorName = name || fullname;

    let filter = {};

    // 2. Logic phân quyền
    if (role === 'Admin') {
        // Admin thấy hết -> Không filter
        filter = {};
    } else if (role === 'Doctor' || role === 'doctors') {
        // Bác sĩ chỉ thấy lịch của mình
        filter = { doctorName: doctorName }; 
        // Hoặc nếu muốn thấy cả khoa: filter = { department: department };
    } else if (role === 'Nurse' || role === 'nurses' || role === 'Staff' || role === 'staffs') {
        // Y tá/Nhân viên thấy lịch của cả Khoa
        filter = { department: department };
    } else {
        // User thường -> Không thấy gì (hoặc chỉ thấy của mình - đã có hàm getBookingsByUserId riêng)
        return []; 
    }

    // 3. Gọi service
    const bookings = await getAllBookingsFromFirestore(filter);
    return bookings;
};