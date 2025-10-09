import { getChatHistory } from '../../infrastructure/services/n8n.services.js';
import { requireFields } from '../../utils/validate.js';

export const fetchChatHistory = async ({ userId }) => {
    requireFields({ userId }, ['userId']);
    const result = await getChatHistory(userId);
    return result;
};