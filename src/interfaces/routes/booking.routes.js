import express from 'express';
import { submitBooking, getDepartmentsAndDoctors, cancelBooking, getBookingsController } from '../controllers/booking.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', requireAuth, submitBooking);
router.get('/departments-doctors', getDepartmentsAndDoctors);
router.post('/cancel/:bookingId', requireAuth, cancelBooking);
router.get('/', requireAuth, getBookingsController);

export default router;