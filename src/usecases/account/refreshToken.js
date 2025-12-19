import axios from 'axios';
import { config } from '../../config/env.js';

export const refreshTokenUsecase = async (refreshToken) => {
    if (!refreshToken) throw new Error('Refresh Token is required');
    if (!config.firebase.apiKey) throw new Error('FIREBASE_API_KEY not configured');

    // API của Google để đổi Refresh Token lấy ID Token mới
    const url = `https://securetoken.googleapis.com/v1/token?key=${config.firebase.apiKey}`;
    
    try {
        const response = await axios.post(url, {
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });
        
        return {
            idToken: response.data.id_token,
            refreshToken: response.data.refresh_token, // Google trả về refresh token mới, nên cập nhật luôn
            expiresIn: response.data.expires_in
        };
    } catch (error) {
        throw new Error('Invalid Refresh Token');
    }
};