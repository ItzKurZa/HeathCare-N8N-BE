import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8n.js';
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

export const getHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const result = await fetchChatHistory({ userId });
        res.status(200).json({ success: true, messages: result });
    } catch (err) {
        next(err);
    }
};