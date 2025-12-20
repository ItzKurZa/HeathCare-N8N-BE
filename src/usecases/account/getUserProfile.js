import { getUserProfile } from '../../infrastructure/services/firebase.services.js';
import { requireFields } from '../../utils/validate.js';

export const getUserProfileData = async ({ uid }) => {
    requireFields({ uid }, ['uid']);
    const result = await getUserProfile(uid);
    return result;
};