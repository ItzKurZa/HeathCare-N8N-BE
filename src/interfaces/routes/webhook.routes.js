import express from 'express';
import { handleN8NBookingCallback, webhookHealthCheck } from '../controllers/webhook.controller.js';
import { getTodaySchedule, getTodayScheduleForDoctor } from '../controllers/schedule.controller.js';
import { verifyWebhookSecret } from '../../infrastructure/middlewares/webhookAuth.middleware.js';

const router = express.Router();

// Health check
router.get('/health', webhookHealthCheck);

// N8N booking callback webhook
// Optional: Uncomment để enable webhook secret verification
// router.post('/n8n/booking', verifyWebhookSecret, handleN8NBookingCallback);
router.post('/n8n/booking', handleN8NBookingCallback);

// Schedule endpoints for N8N automation
router.get('/schedule/today', getTodaySchedule);
router.get('/schedule/today/doctor', getTodayScheduleForDoctor);

export default router;

