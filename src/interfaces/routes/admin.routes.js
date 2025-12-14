import express from 'express';
import { getStatistics, getAllBookings, updateBookingStatus } from '../controllers/admin.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

// Tất cả routes admin đều cần authentication
router.get('/statistics', requireAuth, getStatistics);
router.get('/bookings', requireAuth, getAllBookings);
router.put('/bookings/:bookingId', requireAuth, updateBookingStatus);

export default router;

