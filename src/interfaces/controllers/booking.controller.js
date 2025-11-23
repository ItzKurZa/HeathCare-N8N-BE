import { sendBookingToN8N } from '../../usecases/booking/sendBookingToN8N.js';
import { fetchProfileData } from '../../usecases/booking/fetchBookingData.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { processBookingService } from '../../infrastructure/services/firebase.services.js';

export const submitBooking = async (req, res, next) => {
  try {
    const booking = await processBookingService(req.body); 
    let notifyOk = false;
    let notifyError = null;
     try {
      const n8nResult = await sendBookingToN8N(booking);
      notifyOk = true;
      console.log('✅ N8N notify result:', n8nResult);
    } catch (err) {
      notifyOk = false;
      notifyError = err.message || 'Send notification failed';
      console.error('❌ Error sending booking to N8N:', err);
    }

    return res.json({
      success: true,
      id: booking.id,
      submissionId: booking.submissionId,
      data: booking,
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