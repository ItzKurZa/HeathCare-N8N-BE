import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8N.js';

export const sendMessage = async (req, res, next) => {
  try {
    const { user_id, message } = req.body;
    const result = await sendMessageToN8n({ user_id, message });

    // extract a string reply from the N8N response
    const replyText = Array.isArray(result.messages) && result.messages.length
      ? result.messages[0].text || 'Sorry, no response from AI'
      : 'Sorry, no response from AI';

    console.log('N8N response:', replyText);
    res.status(200).json({ success: true, reply: replyText });
  } catch (err) {
    next(err);
  }
};
