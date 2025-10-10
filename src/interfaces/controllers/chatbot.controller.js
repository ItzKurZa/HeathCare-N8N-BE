import { sendMessageToN8n } from '../../usecases/chatbot/sendMessageToN8N.js';

export const sendMessage = async (req, res, next) => {
  try {
    const { user_id, message } = req.body;
    const result = await sendMessageToN8n({ user_id, message });

    let messages = result.messages;

    if (typeof messages === 'string') {
      try { messages = JSON.parse(messages); } 
      catch(e) { messages = []; console.error('Failed to parse messages', e); }
    }

    const botMessage = Array.isArray(messages) ? messages.find(m => m.role === 'bot') : null;
    const replyText = botMessage ? botMessage.message : 'Sorry, no response from AI';

    console.log('N8N response:', replyText);
    return res.status(200).json({ success: true, reply: replyText });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
};
