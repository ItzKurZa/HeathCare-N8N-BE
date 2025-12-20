import { sendBookingToN8N } from '../../usecases/booking/sendBookingToN8N.js';
import { fetchProfileData } from '../../usecases/booking/fetchBookingData.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { 
  processBookingService, 
  markRemindersSentService, 
  getRemindersDueService,
  getRecentBookingsService,
  getUserBookingsService,
  updateBookingService,
  getBookingByIdService,
  getBookingBySubmissionIdService,
  checkInBookingService

 } from '../../infrastructure/services/firebase.services.js';

import { requireFields } from '../../utils/validate.js';

// Helper function để convert 24h format sang 12h format
const convert24To12 = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

// Helper function để transform booking data
const transformBooking = (booking) => {
  const time24 = booking.startTimeLocal ? booking.startTimeLocal.split(' ')[1] : '';
  return {
    id: booking.id,
    submission_id: booking.submissionId || booking.submission_id, // Mã đặt lịch chính là submissionId
    user_id: booking.userId,
    full_name: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    department: booking.department,
    doctor_name: booking.doctor,
    appointment_date: booking.startTimeLocal ? booking.startTimeLocal.split(' ')[0] : '',
    appointment_time: convert24To12(time24),
    reason: booking.note || 'Khám bệnh',
    status: booking.status === 'canceled' ? 'cancelled' : booking.status,
    notes: booking.note,
    medical_record: booking.medical_record || booking.medicalRecord || undefined, // Hồ sơ bệnh án
    created_at: booking.createdAtUTC,
  };
};

export const submitBooking = async (req, res, next) => {
  try {
    // Kiểm tra role: Doctor không được đặt lịch (theo RBAC model)
    if (req.user && req.user.uid) {
      const { getUserProfile } = await import('../../infrastructure/services/firebase.services.js');
      const userProfile = await getUserProfile(req.user.uid);
      const userRole = userProfile?.role || 'patient';
      
      if (userRole === 'doctor') {
        return res.status(403).json({
          success: false,
          message: 'Bác sĩ không thể đặt lịch khám. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.',
        });
      }
    }

    const booking = await processBookingService(req.body); 
    let notifyOk = false;
    let notifyError = null;
    try {
       await sendBookingToN8N(booking);
      notifyOk = true;
    } catch (err) {
      notifyOk = false;
      notifyError = err.message || 'Send notification failed';
    }

    // Transform data để match với frontend format
    const transformedBooking = transformBooking(booking);

    return res.json({
      success: true,
      message: 'Booking processed successfully',
      booking: transformedBooking,
      notify: {
        success: notifyOk,
        error: notifyError,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentsAndDoctors = async (req, res, next) => {
  try {
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

// đánh dấu nhắc nhở đã gửi
export const markRemindersSent = async (req, res, next) => {
  try {
    const { ids } = req.body; // [id1, id2, ...]
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or missing ids array' });
    }
    const result = await markRemindersSentService(ids || []);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
// lấy danh sách nhắc nhở sắp tới
export const getRemindersDue = async (req, res, next) => {
  try {
    console.log('Received request to get reminders due with query:', req.query);
    const windowMinutes = Number(req.query.windowMinutes ?? 600); // mặc định 10 tiếng
    const result = await getRemindersDueService(windowMinutes);
    return res.json(result.items);
  } catch (err) {
    next(err);
  }
};

export const getRecentBookings = async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim(); // có thể cho phép rỗng (admin xem tất cả)
    const page = Number(req.query.page || '1');
    const pageSize = Number(req.query.pageSize || '10');

    // Nếu API chỉ dành cho user → bắt buộc userId
    // requireFields({ userId }, ['userId']);

    const result = await getRecentBookingsService({
      userId: userId || undefined,
      page,
      pageSize,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getUserBookings = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;
    
    const options = {};
    if (page) options.page = parseInt(page, 10);
    if (limit) options.limit = parseInt(limit, 10);
    
    const result = await getUserBookingsService(userId, options);
    
    // Transform data để match với frontend format
    const transformedBookings = result.bookings.map(transformBooking);

    return res.json({
      success: true,
      bookings: transformedBookings,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    // Kiểm tra role: Doctor không được hủy lịch (theo RBAC model)
    if (req.user && req.user.uid) {
      const { getUserProfile } = await import('../../infrastructure/services/firebase.services.js');
      const userProfile = await getUserProfile(req.user.uid);
      const userRole = userProfile?.role || 'patient';
      
      // Kiểm tra nếu đang hủy lịch
      const isCancelling = req.body.status === 'cancelled' || req.body.status === 'canceled';
      if (isCancelling && userRole === 'doctor') {
        return res.status(403).json({
          success: false,
          message: 'Bác sĩ không thể hủy lịch hẹn. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.',
        });
      }
    }

    const { bookingId } = req.params;
    const updates = req.body;
    
    console.log(`[updateBooking] Received bookingId: "${bookingId}"`);
    
    // Tìm booking trước (có thể là submissionId hoặc UUID)
    let booking;
    try {
      console.log(`[updateBooking] Trying to find by submissionId: "${bookingId}"`);
      booking = await getBookingBySubmissionIdService(bookingId);
      console.log(`[updateBooking] Found by submissionId, using UUID: ${booking.id} for update`);
    } catch (err) {
      console.log(`[updateBooking] Not found by submissionId, trying UUID: "${bookingId}"`);
      // Nếu không tìm thấy theo submissionId, thử tìm theo UUID
      try {
        booking = await getBookingByIdService(bookingId);
        console.log(`[updateBooking] Found by UUID`);
      } catch (err2) {
        console.log(`[updateBooking] Not found by UUID either`);
        throw new Error('Booking not found');
      }
    }
    
    // Sử dụng UUID (doc.id) để update vì Firestore cần document ID
    const updatedBooking = await updateBookingService(booking.id, updates);
    
    // Transform data để match với frontend format
    const transformed = transformBooking(updatedBooking);

    return res.json({
      success: true,
      booking: transformed,
    });
  } catch (err) {
    console.error(`[updateBooking] Error:`, err.message);
    if (err.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đặt lịch',
      });
    }
    next(err);
  }
};

// Get booking by ID (for check-in page) - có thể là UUID hoặc submissionId
export const getBookingById = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    console.log(`[getBookingById] Received bookingId: "${bookingId}"`);
    let booking;
    
    // Thử tìm theo submissionId trước (mã đặt lịch chính)
    try {
      console.log(`[getBookingById] Trying to find by submissionId: "${bookingId}"`);
      booking = await getBookingBySubmissionIdService(bookingId);
      console.log(`[getBookingById] Found by submissionId`);
    } catch (err) {
      console.log(`[getBookingById] Not found by submissionId, trying UUID: "${bookingId}"`);
      // Nếu không tìm thấy theo submissionId, thử tìm theo UUID (backward compatibility)
      try {
        booking = await getBookingByIdService(bookingId);
        console.log(`[getBookingById] Found by UUID`);
      } catch (err2) {
        console.log(`[getBookingById] Not found by UUID either`);
        throw new Error('Booking not found');
      }
    }
    
    // Transform data để match với frontend format
    const transformed = transformBooking(booking);

    return res.json({
      success: true,
      booking: transformed,
    });
  } catch (err) {
    console.error(`[getBookingById] Error:`, err.message);
    if (err.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đặt lịch',
      });
    }
    next(err);
  }
};

// Public update/cancel booking by submissionId (không cần auth)
export const updateBookingByCode = async (req, res, next) => {
  try {
    const { bookingCode } = req.params;
    const updates = req.body;
    
    console.log(`[updateBookingByCode] Received bookingCode: "${bookingCode}"`);
    
    // Tìm booking theo submissionId
    let booking;
    try {
      booking = await getBookingBySubmissionIdService(bookingCode);
      console.log(`[updateBookingByCode] Found by submissionId, using UUID: ${booking.id} for update`);
    } catch (err) {
      console.log(`[updateBookingByCode] Not found by submissionId`);
      throw new Error('Booking not found');
    }
    
    // Kiểm tra nếu đang hủy lịch
    const isCancelling = updates.status === 'cancelled' || updates.status === 'canceled';
    
    // Nếu có user đăng nhập, kiểm tra role (Doctor không được hủy)
    if (req.user && req.user.uid && isCancelling) {
      const { getUserProfile } = await import('../../infrastructure/services/firebase.services.js');
      const userProfile = await getUserProfile(req.user.uid);
      const userRole = userProfile?.role || 'patient';
      
      if (userRole === 'doctor') {
        return res.status(403).json({
          success: false,
          message: 'Bác sĩ không thể hủy lịch hẹn. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.',
        });
      }
    }
    
    if (isCancelling) {
      const updatedBooking = await updateBookingService(booking.id, { status: 'canceled' });
      const transformed = transformBooking(updatedBooking);
      return res.json({
        success: true,
        message: 'Hủy lịch hẹn thành công',
        booking: transformed,
      });
    }
    
    // Update booking với UUID
    const updatedBooking = await updateBookingService(booking.id, updates);
    const transformed = transformBooking(updatedBooking);

    return res.json({
      success: true,
      message: 'Cập nhật lịch hẹn thành công',
      booking: transformed,
    });
  } catch (err) {
    console.error(`[updateBookingByCode] Error:`, err.message);
    if (err.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đặt lịch',
      });
    }
    next(err);
  }
};

// Check-in booking
export const checkInBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    console.log(`[checkInBooking] Received bookingId: "${bookingId}"`);
    
    // Tìm booking trước (có thể là submissionId hoặc UUID)
    let booking;
    try {
      console.log(`[checkInBooking] Trying to find by submissionId: "${bookingId}"`);
      booking = await getBookingBySubmissionIdService(bookingId);
      console.log(`[checkInBooking] Found by submissionId, using UUID: ${booking.id} for check-in`);
    } catch (err) {
      console.log(`[checkInBooking] Not found by submissionId, trying UUID: "${bookingId}"`);
      // Nếu không tìm thấy theo submissionId, thử tìm theo UUID
      try {
        booking = await getBookingByIdService(bookingId);
        console.log(`[checkInBooking] Found by UUID`);
      } catch (err2) {
        console.log(`[checkInBooking] Not found by UUID either`);
        throw new Error('Booking not found');
      }
    }
    
    // Sử dụng UUID (doc.id) để check-in vì Firestore cần document ID
    const checkedInBooking = await checkInBookingService(booking.id);
    
    // Transform data để match với frontend format
    const transformed = transformBooking(checkedInBooking);

    return res.json({
      success: true,
      message: 'Check-in thành công',
      booking: transformed,
    });
  } catch (err) {
    console.error(`[checkInBooking] Error:`, err.message);
    if (err.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đặt lịch',
      });
    }
    if (err.message.includes('đã bị hủy') || err.message.includes('đã được check-in')) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};