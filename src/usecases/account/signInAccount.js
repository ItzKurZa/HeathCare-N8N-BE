import axios from 'axios';
import { config } from '../../config/env.js';
import { requireFields } from '../../utils/validate.js';

export const signInAccount = async ({ email, password }) => {
    try {
    requireFields({ email, password }, ['email', 'password']);
    if (!config.firebase.apiKey) throw new Error('FIREBASE_API_KEY not configured');

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.apiKey}`;
    const response = await axios.post(url, { email, password, returnSecureToken: true });
    return response.data;
    } catch (err) {
         if (err.response?.status === 400) {
      const fbError = err.response.data.error?.message;

      if (fbError === 'INVALID_PASSWORD') {
        const error = new Error('Password không đúng');
        error.status = 401;
        throw error;
      }

      if (fbError === 'EMAIL_NOT_FOUND') {
        const error = new Error('Email không tồn tại');
        error.status = 404;
        throw error;
      }

      const error = new Error('Đăng nhập thất bại');
      error.status = 400;
      throw error;
    }

    // fallback: lỗi mạng, cấu hình API key…
    const error = new Error('Lỗi dịch vụ đăng nhập');
    error.status = 500;
    throw error;
    }
};