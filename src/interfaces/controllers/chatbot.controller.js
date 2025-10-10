import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8N.js';

export const sendMessage = async (req, res, next) => {
    try {
        const { user_id, message } = req.body;
        const result = await sendMessageToN8n({ user_id, message });

        const messages = result.messages; // nếu N8N trả về array trực tiếp
        const replyText = Array.isArray(messages) && messages.length
            ? messages[0].message || 'Sorry, no response from AI'
            : 'Sorry, no response from AI';

        console.log('N8N response:', replyText);
        res.status(200).json({ success: true, reply: replyText });


        console.log('N8N response:', replyText);
        res.status(200).json({ success: true, reply: replyText });
    } catch (err) {
        next(err);
    }
};
