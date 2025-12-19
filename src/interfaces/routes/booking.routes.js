import express from 'express';
import { submitBooking } from '../controllers/booking.controller.js';
import { getDepartmentsAndDoctors } from '../controllers/booking.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';
import { cancelBooking } from '../controllers/booking.controller.js';

const router = express.Router();

router.post('/', requireAuth,submitBooking);
router.get('/departments-doctors', getDepartmentsAndDoctors);
router.post('/cancel/:bookingId', requireAuth, cancelBooking);

export default router;