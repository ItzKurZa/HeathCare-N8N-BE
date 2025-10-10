import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8N.js';

export const sendMessage = async (req, res, next) => {
    try {
        const { user_id, message } = req.body;
        console.log(req.body);
        const result = await sendMessageToN8n({ user_id, message });
        res.status(200).json({ success: true, reply: result });
    } catch (err) {
        next(err);
    }
};