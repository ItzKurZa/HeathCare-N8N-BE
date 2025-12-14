import express from 'express';
import { getDoctorBookings, updateBookingStatus, getDoctorSchedule, updateScheduleAvailability } from '../controllers/doctor.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

// Tất cả routes doctor đều cần authentication
router.get('/bookings', requireAuth, getDoctorBookings);
router.put('/bookings/:bookingId', requireAuth, updateBookingStatus);
router.get('/schedule', requireAuth, getDoctorSchedule);
router.put('/schedule/availability', requireAuth, updateScheduleAvailability);

export default router;

