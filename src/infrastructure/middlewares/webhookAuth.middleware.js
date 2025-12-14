import { config } from '../../config/env.js';

/**
 * Optional middleware để verify webhook requests từ N8N
 * Có thể sử dụng webhook secret token để đảm bảo chỉ N8N mới có thể gọi
 * 
 * Usage: router.post('/n8n/booking', verifyWebhookSecret, handleN8NBookingCallback);
 */

export const verifyWebhookSecret = (req, res, next) => {
  // Optional: Check if webhook secret is configured
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  // Nếu không config secret, skip verification (allow all)
  if (!webhookSecret) {
    return next();
  }

  // Verify secret từ header hoặc query param
  const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;

  if (!providedSecret) {
    return res.status(401).json({
      success: false,
      error: 'Webhook secret is required',
    });
  }

  if (providedSecret !== webhookSecret) {
    return res.status(403).json({
      success: false,
      error: 'Invalid webhook secret',
    });
  }

  next();
};

