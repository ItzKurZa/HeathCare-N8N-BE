// src/routes/test.routes.js
import express from 'express';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/test-token
 * Kiểm tra token gửi kèm trong header Authorization
 * Nếu token hợp lệ: trả về payload của token (user info)
 * Nếu token không hợp lệ hoặc không có token: trả về 401
 */
router.get('/test-token', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Token hợp lệ!',
    user: req.user, // thông tin decoded từ Firebase token
  });
});

export default router;
