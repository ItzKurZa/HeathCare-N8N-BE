import { createUser } from '../../infrastructure/services/firebase.services.js';
import { requireFields, toE164 } from '../../utils/validate.js';

export const createAccount = async ({ email, password, fullname, phone, cccd }) => {
    requireFields({ email, password }, ['email', 'password']);
    console.log('Creating account for:', phone);
    const result = await createUser({ email, password, fullname, phone: toE164(phone), cccd });
    return result;
};
