import axios from 'axios';
import FormData from 'form-data';
import { config } from '../../config/env.js';

export const sendBooking = async (bookingData) => {
    const url = config.n8n.booking;
    if (!url) throw new Error('N8N booking webhook URL not configured');
    const r = await axios.post(url, bookingData, { timeout: 15000 });
    return r.data;
};

export const sendMedicalFile = async ({ fields, file }) => {
    const url = config.n8n.medical;
    if (!url) throw new Error('N8N medical webhook URL not configured');

    const form = new FormData();
    // append text fields
    Object.keys(fields || {}).forEach((k) => form.append(k, fields[k]));
    // file: multer memoryStorage gives file.buffer
    form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

    const headers = form.getHeaders();
    const r = await axios.post(url, form, { headers, maxBodyLength: Infinity, timeout: 30000 });
    return r.data;
};

export const fetchUserData = async (userId) => {
    const url = config.n8n.fetch;
    if (!url) throw new Error('N8N fetch webhook URL not configured');
    // send POST with userId so n8n can filter results
    const r = await axios.post(url, { userId }, { timeout: 15000 });
    return r.data;
};