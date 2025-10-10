import { sendChatMessage } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const sendMessageToN8n = async ({ user_id, message }) => {
    requireFields({ user_id, message }, ['user_id', 'message']);
    console.log('Sending message to N8N:', user_id, message);
    const result = await sendChatMessage({ user_id, message });
    return result;
};