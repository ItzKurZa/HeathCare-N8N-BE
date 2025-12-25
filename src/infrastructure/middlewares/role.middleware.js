import { getUserProfile } from '../services/firebase.services.js';

/**
 * Middleware để kiểm tra role của user
 * @param {string[]} allowedRoles - Mảng các role được phép truy cập
 */
export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // requireAuth đã set req.user từ token
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - User not authenticated',
        });
      }

      // Lấy user profile từ Firestore để lấy role
      const userProfile = await getUserProfile(req.user.uid);
      
      if (!userProfile) {
        return res.status(404).json({
          success: false,
          message: 'User profile not found',
        });
      }

      const userRole = userProfile.role || 'patient';

      // Kiểm tra role
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden - Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}`,
        });
      }

      // Gắn role vào req.user để sử dụng trong controller
      req.user.role = userRole;
      req.user.profile = userProfile;

      next();
    } catch (err) {
      console.error('[requireRole] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while checking role',
        error: err.message,
      });
    }
  };
};

