import { updateBookingFromN8N } from '../../infrastructure/services/firebase.services.js';

/**
 * Webhook controller để nhận callback từ N8N
 * N8N sẽ gọi endpoint này sau khi xử lý notification hoặc có update
 */

/**
 * Webhook callback cho booking updates từ N8N
 * 
 * Expected payload từ N8N:
 * {
 *   "bookingId": "abc123",
 *   "action": "notification_sent" | "notification_failed" | "booking_confirmed" | "status_update",
 *   "status"?: "confirmed" | "pending" | "completed" | "canceled",
 *   "reminderSentAtUTC"?: "2024-12-25T10:00:00.000Z",
 *   "notificationMethod"?: "email" | "sms" | "both",
 *   "error"?: "Error message if failed",
 *   "metadata"?: {}
 * }
 */
export const handleN8NBookingCallback = async (req, res, next) => {
  try {
    const payload = req.body;

    // Validate required fields
    if (!payload.bookingId) {
      return res.status(400).json({
        success: false,
        error: 'bookingId is required',
      });
    }

    if (!payload.action) {
      return res.status(400).json({
        success: false,
        error: 'action is required',
      });
    }

    // Valid actions
    const validActions = [
      'notification_sent',
      'notification_failed',
      'booking_confirmed',
      'status_update',
      'reminder_sent',
      'reminder_failed',
    ];

    if (!validActions.includes(payload.action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    // Update booking based on action
    const result = await updateBookingFromN8N(payload);

    return res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      booking: result,
    });
  } catch (err) {
    // Log error for debugging
    console.error('❌ Error in N8N webhook callback:', err);

    // If booking not found, return 404
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
      });
    }

    // Other errors
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  }
};

/**
 * Health check endpoint cho N8N để verify webhook is working
 */
export const webhookHealthCheck = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
};

