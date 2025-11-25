import { sendBookingToN8n } from '../../usecases/booking/sendBookingToN8N.js';
import { fetchProfileData } from '../../usecases/booking/fetchBookingData.js';
import { getDepartmentsAndDoctorsService } from '../../usecases/booking/getDepartmentsAndDoctors.js';
import { firestore } from '../../config/firebase.js';

export const submitBooking = async (req, res, next) => {
  try {
    // Gửi booking qua n8n như cũ
    const result = await sendBookingToN8n(req.body);
    
    // Lưu booking vào Firestore để tracking
    const appointmentData = {
      bookingId: result.bookingId || result.id || null,
      fullName: req.body.fullName || req.body.name,
      phone: req.body.phone,
      email: req.body.email || null,
      doctor: req.body.doctor,
      department: req.body.department || null,
      startTimeLocal: req.body.startTime || req.body.appointmentDate,
      visitStatus: 'SCHEDULED',
      survey_sent: false,
      survey_completed: false,
      voice_call_attempted: false,
      voice_call_status: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await firestore.collection('appointments').add(appointmentData);
    console.log('✅ Appointment saved to Firestore for tracking');
    
    res.status(200).json({ success: true, result });
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