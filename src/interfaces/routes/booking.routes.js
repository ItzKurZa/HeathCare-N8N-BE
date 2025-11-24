import express from 'express';
import { submitBooking, getProfileData } from '../controllers/booking.controller.js';
import { getDepartmentsAndDoctors, getRemindersDue, markRemindersSent, getRecentBookings } from '../controllers/booking.controller.js';

const router = express.Router();

router.post('/', submitBooking);
router.get('/departments-doctors', getDepartmentsAndDoctors);
router.get('/reminders-due', getRemindersDue);
router.post('/reminders/mark-sent', markRemindersSent);
router.get('/recent', getRecentBookings);
// router.get('/:userId', getProfileData);


export default router;