import { sendBookingToN8n } from '../../usecases/booking/sendBookingToN8N.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { cancelBookingUsecase } from '../../usecases/booking/cancelBooking.js';
import { getBookings } from '../../usecases/booking/getBookings.js';

export const submitBooking = async (req, res, next) => {
  try {
    // [THAY ĐỔI QUAN TRỌNG] Lấy uid từ req.user và gộp vào body
    const bookingData = {
      ...req.body,
      uid: req.user.uid // Giả sử auth middleware đã gán user vào req
    };

    const result = await sendBookingToN8n(bookingData);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentsAndDoctors = async (req, res, next) => {
  try {
    const { departments, doctors } = await getDepartmentsAndDoctorsService();
    console.log('Controller fetching data success');

    res.status(200).json({
      success: true,
      data: {
        departments,
        doctors
      }
    });

  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const uid = req.user.uid;

        const result = await cancelBookingUsecase(bookingId, uid);

        res.status(200).json({ 
            success: true, 
            message: 'Booking cancelled successfully', 
            data: result 
        });
    } catch (err) {
        next(err);
    }
};

export const getBookingsController = async (req, res, next) => {
    try {
        const uid = req.user.uid; // Lấy từ token
        const result = await getBookings(uid);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};