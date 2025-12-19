import express from 'express';
import { submitBooking } from '../controllers/booking.controller.js';
import { getDepartmentsAndDoctors } from '../controllers/booking.controller.js';

const router = express.Router();

router.post('/', submitBooking);
router.get('/departments-doctors', getDepartmentsAndDoctors);

export default router;