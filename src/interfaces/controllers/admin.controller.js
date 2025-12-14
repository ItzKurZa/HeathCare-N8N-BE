import {
  getStatisticsService,
  getAllBookingsService,
  updateBookingStatusService,
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

export const getStatistics = async (req, res, next) => {
  try {
    const statistics = await getStatisticsService();
    return res.json({
      success: true,
      statistics,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    const { status, department, dateFrom, dateTo } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (department) filters.department = department;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const bookings = await getAllBookingsService(filters);
    
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

