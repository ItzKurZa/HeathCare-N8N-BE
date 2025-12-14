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
    created_at: booking.createdAtUTC,
  };
};

export const getDoctorBookings = async (req, res, next) => {
  try {
    const { doctor, status, dateFrom, dateTo } = req.query;
    
    if (!doctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required',
      });
    }

    const filters = { doctor };
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const bookings = await getDoctorBookingsService(filters);
    
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

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updatedBooking = await updateBookingStatusService(bookingId, status);
    
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

