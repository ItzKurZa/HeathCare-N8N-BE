import axios from 'axios';
import { config } from '../../config/env.js';
import { requireFields } from '../../utils/validate.js';

export const signInAccount = async ({ email, password }) => {
    requireFields({ email, password }, ['email', 'password']);
    if (!config.firebase.apiKey) throw new Error('FIREBASE_API_KEY not configured');

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.apiKey}`;
    const response = await axios.post(url, { email, password, returnSecureToken: true });
    return response.data;
};