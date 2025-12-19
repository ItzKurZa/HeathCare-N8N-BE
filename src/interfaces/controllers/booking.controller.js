import { sendBookingToN8n } from '../../usecases/booking/sendBookingToN8N.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { cancelBookingUsecase } from '../../usecases/booking/cancelBooking.js';

export const submitBooking = async (req, res, next) => {
  try {
    
    const bookingData = {
        ...req.body,
        user_id: req.user.uid
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