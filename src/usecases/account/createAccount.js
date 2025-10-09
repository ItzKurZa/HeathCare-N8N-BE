import { createUser } from '../../infrastructure/services/firebase.services.js';
import { requireFields } from '../../utils/validate.js';

export const createAccount = async ({ email, password, fullName, phone, CCCD }) => {
    requireFields({ email, password }, ['email', 'password']);
    const result = await createUser({ email, password, fullName, phone, CCCD });
    return result;
};