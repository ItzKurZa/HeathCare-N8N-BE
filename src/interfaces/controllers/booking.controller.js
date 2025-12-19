import { sendBookingToN8n } from '../../usecases/booking/sendBookingToN8N.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';

export const submitBooking = async (req, res, next) => {
  try {
    const result = await sendBookingToN8n(req.body);
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