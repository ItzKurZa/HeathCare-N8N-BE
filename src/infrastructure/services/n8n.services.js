import axios from 'axios';
import { config } from '../../config/env.js';

export const sendBooking = async (bookingData) => {
    const url = config.n8n.booking;
    if (!url) throw new Error('N8N booking webhook URL not configured');
    const r = await axios.post(url, bookingData, { timeout: 15000 });
    return r.data;
};

export const sendMedicalFile = async ({ fields }) => {
    const url = config.n8n.medical;
    if (!url) throw new Error('N8N medical webhook URL not configured');

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
    const r = await axios.post(url, { userId }, { timeout: 15000 });
    return r.data;
};

export const sendChatMessage = async ({ userId, message }) => {
    const url = config.n8n.chatSend;
    if (!url) throw new Error('N8N chat send webhook not configured');
    console.log('Posting to N8N chat webhook:', url, userId, message);
    const r = await axios.post(url, { userId, message}, { timeout: 15000 });
    return r.data;
};