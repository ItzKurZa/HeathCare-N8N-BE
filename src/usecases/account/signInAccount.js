import axios from 'axios';
import { config } from '../../config/env.js';
import { requireFields } from '../../utils/validate.js';
import { getUserAnywhere } from '../../infrastructure/services/firebase.services.js'; // Import hàm mới

export const signInAccount = async ({ email, password }) => {
    requireFields({ email, password }, ['email', 'password']);
    if (!config.firebase.apiKey) throw new Error('FIREBASE_API_KEY not configured');

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.apiKey}`;
    const response = await axios.post(url, { email, password, returnSecureToken: true });
    
    const authData = response.data;
    const uid = authData.localId;

    const userProfile = await getUserAnywhere(uid);

    if (!userProfile) {
        throw new Error('Tài khoản không tồn tại trên hệ thống dữ liệu.');
    }

    if (userProfile.collection === 'users' || userProfile.role === 'patient') {
        throw new Error('Truy cập bị từ chối: Tài khoản bệnh nhân không được phép đăng nhập vào hệ thống này.');
    }

    return {
        ...authData,
        role: userProfile.role,
        name: userProfile.name
    };
};