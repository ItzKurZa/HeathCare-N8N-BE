import express from 'express';
import { handleN8NBookingCallback, webhookHealthCheck } from '../controllers/webhook.controller.js';
import { verifyWebhookSecret } from '../../infrastructure/middlewares/webhookAuth.middleware.js';

const router = express.Router();

// Health check
router.get('/health', webhookHealthCheck);

// N8N booking callback webhook
// Optional: Uncomment để enable webhook secret verification
// router.post('/n8n/booking', verifyWebhookSecret, handleN8NBookingCallback);
router.post('/n8n/booking', handleN8NBookingCallback);

export default router;

