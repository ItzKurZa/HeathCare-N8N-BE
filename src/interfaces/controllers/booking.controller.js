import { sendBookingToN8n } from '../../usecases/booking/sendBookingToN8N.js';
import { fetchProfileData } from '../../usecases/booking/fetchBookingData.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { seedDatabase } from '../../infrastructure/services/firebase.services.js';

export const submitBooking = async (req, res, next) => {
  try {
    const result = await sendBookingToN8n(req.body);
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentsAndDoctors = async (req, res, next) => {
  try {
    // ==================================================================
    // [HƯỚNG DẪN TẠO DỮ LIỆU]
    // Bước 1: Bỏ comment dòng 'await seedDatabase();' ở dưới.
    // Bước 2: Lưu file, đợi Server khởi động lại.
    // Bước 3: F5 trang Booking ở Frontend (để kích hoạt hàm này chạy).
    // Bước 4: Sau khi thấy dữ liệu hiện ra, hãy comment dòng này lại để tránh tạo trùng lặp.
    // ==================================================================
    await seedDatabase(); 

    const { departments, doctors } = await getDepartmentsAndDoctorsService();
    console.log('Controller received departments and doctors:', { departments, doctors });
    res.status(200).json({ success: true, departments, doctors });
  } catch (err) {
    console.error('Error in controller:', err);
    if (next) {
      next(err);
    } else {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
};

export const getProfileData = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await fetchProfileData({ userId });
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
};