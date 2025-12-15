import axios from 'axios';
import { config } from '../../config/env.js';

export const sendBooking = async (bookingData) => {
    console.log('Sending booking data to N8N:', bookingData);
    const url = config.n8n.booking;
    if (!url) throw new Error('N8N booking webhook URL not configured');
    
    const headers = { 
        'Content-Type': 'application/json',
    };
    
    if (process.env.N8N_WEBHOOK_SECRET) {
        headers['X-API-KEY'] = process.env.N8N_WEBHOOK_SECRET;
    }
    
    const r = await axios.post(url, bookingData, { 
        headers,
        timeout: 15000 
    });
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

export const sendChatMessage = async ({ user_id, message }) => {
    const url = config.n8n.chatSend;
    if (!url) throw new Error('N8N chat send webhook not configured');
    const r = await axios.post(url, { user_id, message }, { timeout: 60000 });
    return r.data;
};

export const fetchDepartmentsAndDoctors = async () => {
    const url = config.n8n.departmentsDoctors;
    if (!url) throw new Error('N8N departments/doctors webhook URL not configured');

    try {
        const r = await axios.get(url, { timeout: 60000 });

        const { departments = [], doctorsByDepartment = {} } = r.data || {};

        const doctors = Object.entries(doctorsByDepartment).flatMap(([dept, names]) =>
            names.map((name) => ({ name, department_id: dept }))
        );

        return { departments, doctors };
    } catch (err) {
        if (err.response) {
            console.error('❌ Axios error response status:', err.response.status);
            console.error('❌ Axios error response data:', err.response.data);
        } else {
            console.error('❌ Error fetching departments/doctors from N8N:', err.message);
        }
        return { departments: [], doctors: [] };
    }
};

