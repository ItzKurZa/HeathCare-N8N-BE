import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8N.js';

export const sendMessage = async (req, res, next) => {
    try {
        const { user_id, message } = req.body;
        const result = await sendMessageToN8n({ user_id, message });
        const replyText = result.messages?.[0]?.text || 'Sorry, no response from AI';
        res.status(200).json({ success: true, reply: replyText });
    } catch (err) {
        next(err);
    }
};