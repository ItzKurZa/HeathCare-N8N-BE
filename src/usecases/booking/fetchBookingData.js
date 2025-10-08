import { fetchUserData } from '../../infrastructure/services/n8n.service.js';
import { requireFields } from '../../utils/validate.js';

export const fetchProfileData = async ({ userId }) => {
    requireFields({ userId }, ['userId']);
    const result = await fetchUserData(userId);
    return result;
};