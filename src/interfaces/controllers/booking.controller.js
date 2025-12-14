import { sendBookingToN8N } from '../../usecases/booking/sendBookingToN8N.js';
import { fetchProfileData } from '../../usecases/booking/fetchBookingData.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { 
  processBookingService, 
  markRemindersSentService, 
  getRemindersDueService,
  getRecentBookingsService,
  getUserBookingsService,
  updateBookingService

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
    created_at: booking.createdAtUTC,
  };
};

export const submitBooking = async (req, res, next) => {
  try {
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
    const bookings = await getUserBookingsService(userId);
    
    // Transform data để match với frontend format
    const transformedBookings = bookings.map(transformBooking);

    return res.json({
      success: true,
      bookings: transformedBookings,
    });
  } catch (err) {
    next(err);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const updates = req.body;
    
    const updatedBooking = await updateBookingService(bookingId, updates);
    
    // Transform data để match với frontend format
    const transformed = transformBooking(updatedBooking);

    return res.json({
      success: true,
      booking: transformed,
    });
  } catch (err) {
    next(err);
  }
};