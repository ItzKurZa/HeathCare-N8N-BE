import express from 'express';
import { submitBooking, getProfileData } from '../controllers/booking.controller.js';
import { getDepartmentsAndDoctors, getRemindersDue, markRemindersSent, getRecentBookings, getUserBookings, updateBooking, getBookingById, checkInBooking } from '../controllers/booking.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', submitBooking);
router.get('/departments-doctors', getDepartmentsAndDoctors);
router.get('/reminders-due', getRemindersDue);
router.post('/reminders/mark-sent', markRemindersSent);
router.get('/recent', getRecentBookings);
router.get('/user/:userId', requireAuth, getUserBookings);
router.put('/:bookingId', requireAuth, updateBooking);

// Check-in routes (public - không cần auth vì dùng QR code)
router.get('/check-in/:bookingId', getBookingById);
router.post('/check-in/:bookingId', checkInBooking);
// router.get('/:userId', getProfileData);


export default router;