import { signOutUser } from '../../infrastructure/services/firebase.services.js';

export const signOutAccount = async (uid) => {
    if (!uid) throw new Error('Missing user ID for sign out');
    const result = await signOutUser(uid);
    return result;
};