import { getChatHistory } from '../../infrastructure/services/n8n.service.js';
import { requireFields } from '../../utils/validate.js';

export const fetchChatHistory = async ({ userId }) => {
    requireFields({ userId }, ['userId']);
    const result = await getChatHistory(userId);
    return result;
};