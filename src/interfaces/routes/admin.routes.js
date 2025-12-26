import express from 'express';
import { getStatistics, getAllBookings, updateBookingStatus, updateUserRoleController, createDoctor, getAllDepartments } from '../controllers/admin.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';
import { requireRole } from '../../infrastructure/middlewares/role.middleware.js';

const router = express.Router();

// Tất cả routes admin đều cần authentication và role admin
router.get('/statistics', requireAuth, requireRole(['admin']), getStatistics);
router.get('/bookings', requireAuth, requireRole(['admin']), getAllBookings);
router.get('/departments', requireAuth, requireRole(['admin']), getAllDepartments);
router.put('/bookings/:bookingId', requireAuth, requireRole(['admin']), updateBookingStatus);
router.put('/users/:userId/role', requireAuth, requireRole(['admin']), updateUserRoleController);
router.post('/doctors', requireAuth, requireRole(['admin']), createDoctor);

export default router;

