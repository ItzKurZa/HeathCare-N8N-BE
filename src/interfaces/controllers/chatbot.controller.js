import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8N.js';
import { fetchChatHistory } from '../../usecases/chatbot/getChatHistory.js';

export const sendMessage = async (req, res, next) => {
    try {
        const { userId, message } = req.body;
        const result = await sendMessageToN8n({ userId, message });
        res.status(200).json({ success: true, reply: result });
    } catch (err) {
        next(err);
    }
};