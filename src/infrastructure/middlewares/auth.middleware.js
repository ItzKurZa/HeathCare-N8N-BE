import { verifyIdToken } from '../services/firebase.service.js';

export const requireAuth = async (req, res, next) => {
    try {
        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ success: false, message: 'Authorization header missing' });
        const parts = auth.split(' ');
        const token = parts.length === 2 ? parts[1] : parts[0];
        const decoded = await verifyIdToken(token);
        req.user = decoded; // uid, email, etc.
        next();
    } catch (err) {
        next(err);
    }
};