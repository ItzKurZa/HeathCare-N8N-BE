import {
  getDoctorBookingsService,
  updateBookingStatusService,
  getDoctorScheduleService,
  updateScheduleAvailabilityService,
} from '../../infrastructure/services/firebase.services.js';

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
    medical_record: booking.medical_record || booking.medicalRecord || undefined, // Hồ sơ bệnh án
    created_at: booking.createdAtUTC,
  };
};

export const getDoctorBookings = async (req, res, next) => {
  try {
    // Lấy thông tin doctor từ user profile (đã được set bởi requireRole middleware)
    const userProfile = req.user?.profile;
    if (!userProfile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found',
      });
    }

    const doctorName = userProfile.doctor_name || userProfile.fullname;

    if (!doctorName) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name not found in profile. Please set doctor_name in user profile.',
      });
    }

    const { status, dateFrom, dateTo, page, limit } = req.query;

    // Theo RBAC model: Doctor chỉ xem lịch của chính mình (không xem lịch trong khoa)
    const filters = { 
      doctor: doctorName,
    };
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (page) filters.page = parseInt(page, 10);
    if (limit) filters.limit = parseInt(limit, 10);

    const result = await getDoctorBookingsService(filters);
    
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

export const updateBookingStatus = async (req, res, next) => {
  try {
    // Lấy thông tin doctor từ user profile
    const userProfile = req.user?.profile;
    if (!userProfile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found',
      });
    }

    const doctorName = userProfile.doctor_name || userProfile.fullname;

    if (!doctorName) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name not found in profile',
      });
    }

    const { bookingId } = req.params;
    const { status, medical_record } = req.body;

    // Kiểm tra quyền: booking phải được đặt cho chính doctor đó (theo RBAC model)
    const { getBookingByIdService } = await import('../../infrastructure/services/firebase.services.js');
    const booking = await getBookingByIdService(bookingId);
    
    const bookingDoctor = booking.doctor || '';

    // Kiểm tra: booking phải của chính doctor (không xem lịch trong khoa)
    const isAuthorized = bookingDoctor === doctorName;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền cập nhật lịch hẹn này. Chỉ có thể cập nhật lịch hẹn được đặt cho chính bạn.',
      });
    }

    // Nếu có medical_record, cập nhật hồ sơ bệnh án
    const updates = {};
    if (status) {
      updates.status = status;
    }
    if (medical_record !== undefined) {
      updates.medical_record = medical_record;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp status hoặc medical_record để cập nhật',
      });
    }

    if (status) {
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
    }

    const updatedBooking = await updateBookingStatusService(bookingId, updates);
    
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

export const getDoctorSchedule = async (req, res, next) => {
  try {
    const { doctor, dateFrom, dateTo } = req.query;
    
    if (!doctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required',
      });
    }

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required',
      });
    }

    const schedule = await getDoctorScheduleService(doctor, dateFrom, dateTo);
    
    return res.json({
      success: true,
      schedule,
    });
  } catch (err) {
    next(err);
  }
};

export const updateScheduleAvailability = async (req, res, next) => {
  try {
    const { doctor_name, date, time, available } = req.body;
    
    if (!doctor_name || !date || !time || typeof available !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'doctor_name, date, time, and available are required',
      });
    }

    await updateScheduleAvailabilityService(doctor_name, date, time, available);
    
    return res.json({
      success: true,
      message: 'Schedule availability updated',
    });
  } catch (err) {
    next(err);
  }
};

