import express from 'express';
import { getDoctorBookings, updateBookingStatus, getDoctorSchedule, updateScheduleAvailability } from '../controllers/doctor.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';
import { requireRole } from '../../infrastructure/middlewares/role.middleware.js';

const router = express.Router();

// Tất cả routes doctor đều cần authentication và role doctor hoặc admin
router.get('/bookings', requireAuth, requireRole(['doctor', 'admin']), getDoctorBookings);
router.put('/bookings/:bookingId', requireAuth, requireRole(['doctor', 'admin']), updateBookingStatus);
router.get('/schedule', requireAuth, requireRole(['doctor', 'admin']), getDoctorSchedule);
router.put('/schedule/availability', requireAuth, requireRole(['doctor', 'admin']), updateScheduleAvailability);

export default router;

