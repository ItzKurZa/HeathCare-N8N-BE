import { sendChatMessage } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const sendMessageToN8n = async ({ userId, message }) => {
    requireFields({ userId, message }, ['user_id', 'message']);
    const result = await sendChatMessage({ userId, message });
    return result;
};