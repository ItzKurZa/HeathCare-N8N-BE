import { sendBookingToN8n } from '../../usecases/booking/sendBookingToN8N.js';
import { fetchProfileData } from '../../usecases/booking/fetchBookingData.js';

export const submitBooking = async (req, res, next) => {
    try {
        const result = await sendBookingToN8n(req.body);
        res.status(200).json({ success: true, result });
    } catch (err) {
        next(err);
    }
};

export const getProfileData = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const result = await fetchProfileData({ userId });
        res.status(200).json({ success: true, result });
    } catch (err) {
        next(err);
    }
};