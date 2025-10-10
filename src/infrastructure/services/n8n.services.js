import axios from 'axios';
import FormData from 'form-data';
import { config } from '../../config/env.js';

export const sendBooking = async (bookingData) => {
    const url = config.n8n.booking;
    if (!url) throw new Error('N8N booking webhook URL not configured');
    const r = await axios.post(url, bookingData, { timeout: 15000 });
    return r.data;
};

import axios from 'axios';
import { config } from '../../config/env.js';

export const sendMedicalFile = async ({ fields }) => {
    const url = config.n8n.medical;
    if (!url) throw new Error('N8N medical webhook URL not configured');

    // ⚙️ Kiểm tra dữ liệu đầu vào
    if (!fields?.fileUrl) {
        throw new Error('Missing fileUrl in payload');
    }

    try {
        const r = await axios.post(url, fields, {
            headers: { 'Content-Type': 'application/json' },
            maxBodyLength: Infinity,
            timeout: 30000,
        });

        return r.data;
    } catch (err) {
        console.error('❌ Error sending medical file to N8N:', err.message);
        throw err;
    }
};

export const fetchUserData = async (userId) => {
    const url = config.n8n.fetch;
    if (!url) throw new Error('N8N fetch webhook URL not configured');
    // send POST with userId so n8n can filter results
    const r = await axios.post(url, { userId }, { timeout: 15000 });
    return r.data;
};

export const sendChatMessage = async ({ userId, message }) => {
    const url = config.n8n.chatSend;
    if (!url) throw new Error('N8N chat send webhook not configured');
    const r = await axios.post(url, { userId, message, timestamp: Date.now() }, { timeout: 15000 });
    return r.data;
};

export const getChatHistory = async (userId) => {
    const url = config.n8n.chatHistory;
    if (!url) throw new Error('N8N chat history webhook not configured');
    const r = await axios.post(url, { userId }, { timeout: 15000 });
    return r.data;
};