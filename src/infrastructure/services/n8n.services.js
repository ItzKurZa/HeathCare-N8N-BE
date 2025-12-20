import axios from 'axios';
import { config, getFrontendUrl } from '../../config/env.js';

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

/**
 * Gửi email thông báo hủy lịch hẹn qua N8N
 * @param {Object} bookingData - Thông tin booking đã bị hủy
 * @returns {Promise<Object>} Response từ N8N
 */
export const sendCancelBookingEmail = async (bookingData) => {
    console.log('Sending cancel booking notification to N8N:', {

        id: bookingData.id,
        submissionId: bookingData.submissionId,
        email: bookingData.email
    });
    
    const url = config.n8n.cancelBooking;
    if (!url) {
        console.warn('⚠️ N8N cancel booking webhook URL not configured. Skipping email notification.');
        return null;
    }
        
    
    console.log(`[sendCancelBookingEmail] Using webhook URL: ${url}`);
    
    const headers = { 
        'Content-Type': 'application/json',
    };
    
    if (process.env.N8N_WEBHOOK_SECRET) {
        headers['X-API-KEY'] = process.env.N8N_WEBHOOK_SECRET;
    }
    
    // Format appointment date/time (tương thích với hàm prepare email trong N8N)
    const startTimeLocal = bookingData.startTimeLocal || '';
    const startTimeParts = startTimeLocal.split(' ');
    const appointmentDate = startTimeParts[0] || '';
    const appointmentTime = startTimeParts.slice(1).join(' ') || '';
    
    const cancelledAt = bookingData.endTimeUTC || bookingData.updatedAtUTC || new Date().toISOString();
    const frontendUrl = getFrontendUrl();
    
    // Format date helper (giống hàm trong N8N)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };
    
    // Chuẩn bị payload tương thích với hàm prepare email trong N8N
    const payload = {
        action: 'cancel',
        id: bookingData.id,
        submissionId: bookingData.submissionId || bookingData.id,
        bookingCode: bookingData.submissionId || bookingData.id,
        maDatLich: bookingData.submissionId || bookingData.id,
        
        // Thông tin booking (để N8N prepare email)
        fullName: bookingData.fullName || bookingData.full_name || '',
        email: bookingData.email || '',
        phone: bookingData.phone || '',
        department: bookingData.department || '',
        doctor: bookingData.doctor || bookingData.doctor_name || '',
        note: bookingData.note || bookingData.reason || '',
        startTimeLocal: startTimeLocal,
        
        // Thông tin hủy lịch
        cancelledAt: cancelledAt,
        cancelledDate: new Date(cancelledAt).toLocaleDateString('vi-VN'),
        cancelledTime: new Date(cancelledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        
        // Metadata
        createdAt: bookingData.createdAtUTC || '',
        status: 'canceled',
        frontendUrl: frontendUrl,
        
        // Email data structure (sẽ được N8N prepare email function xử lý)
        // Gửi thêm để tương thích với template cũ
        emailData: {
            fullName: bookingData.fullName || bookingData.full_name || '',
            bookingCode: bookingData.submissionId || bookingData.id,
            submissionId: bookingData.submissionId || bookingData.id,
            department: bookingData.department || '',
            doctor: bookingData.doctor || bookingData.doctor_name || '',
            appointment_date: appointmentDate,
            appointment_date_formatted: formatDate(appointmentDate),
            appointment_time: appointmentTime,
            reason: bookingData.note || bookingData.reason || '',
            cancelledDate: new Date(cancelledAt).toLocaleDateString('vi-VN'),
            cancelledTime: new Date(cancelledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            bookingUrl: `${frontendUrl}/booking/${bookingData.submissionId || bookingData.id}`,
            cancelUrl: `${frontendUrl}/booking/${bookingData.submissionId || bookingData.id}`,
            checkInUrl: `${frontendUrl}/check-in/${bookingData.submissionId || bookingData.id}`,
            phoneNumber: config.support.phone,
            supportEmail: config.support.email,
            clinicAddress: config.support.address,
            mapUrl: config.support.mapUrl,
            logoUrl: config.support.logoUrl,
        }
    };
    
    try {
        console.log('✅ Cancel booking email payload:', payload);
        const r = await axios.post(url, payload, { 
            headers,
            timeout: 15000 
        });
        console.log('✅ Cancel booking email sent successfully');
        return r.data;
    } catch (err) {
        console.error('❌ Error sending cancel booking email to N8N:', err.message);
        if (err.response) {
            console.error('❌ Response status:', err.response.status);
            console.error('❌ Response data:', err.response.data);
        }
        // Không throw error để không ảnh hưởng đến flow chính
        return null;
    }
};

/**
 * Gửi email thông báo cập nhật lịch hẹn qua N8N
 * @param {Object} bookingData - Thông tin booking đã được cập nhật
 * @param {Array} changes - Danh sách các thay đổi (optional)
 * @returns {Promise<Object>} Response từ N8N
 */
export const sendUpdateBookingEmail = async (bookingData, changes = []) => {
    console.log('Sending update booking notification to N8N:', {
        id: bookingData.id,
        submissionId: bookingData.submissionId,
        email: bookingData.email,
        changes: changes.length
    });
    
    const url = config.n8n.updateBooking;
    if (!url) {
        console.warn('⚠️ N8N update booking webhook URL not configured. Skipping email notification.');
        return null;
    }
    
    console.log(`[sendUpdateBookingEmail] Using webhook URL: ${url}`);
        
    const headers = { 
        'Content-Type': 'application/json',
    };
    
    if (process.env.N8N_WEBHOOK_SECRET) {
        headers['X-API-KEY'] = process.env.N8N_WEBHOOK_SECRET;
    }
    
    // Format appointment date/time (tương thích với hàm prepare email trong N8N)
    const startTimeLocal = bookingData.startTimeLocal || '';
    const startTimeParts = startTimeLocal.split(' ');
    const appointmentDate = startTimeParts[0] || '';
    const appointmentTime = startTimeParts.slice(1).join(' ') || '';
    
    const updatedAt = bookingData.updatedAtUTC || new Date().toISOString();
    const frontendUrl = getFrontendUrl();
    
    // Format date helper (giống hàm trong N8N)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };
    
    // Chuẩn bị payload tương thích với hàm prepare email trong N8N
    const payload = {
        action: 'update',
        id: bookingData.id,
        submissionId: bookingData.submissionId || bookingData.id,
        bookingCode: bookingData.submissionId || bookingData.id,
        maDatLich: bookingData.submissionId || bookingData.id,
        
        // Thông tin booking (để N8N prepare email)
        fullName: bookingData.fullName || bookingData.full_name || '',
        email: bookingData.email || '',
        phone: bookingData.phone || '',
        department: bookingData.department || '',
        doctor: bookingData.doctor || bookingData.doctor_name || '',
        note: bookingData.note || bookingData.reason || '',
        startTimeLocal: startTimeLocal,
        
        // Thông tin cập nhật
        changes: changes, // Array of change descriptions
        updatedAt: updatedAt,
        updatedDate: formatDate(updatedAt.split('T')[0]),
        updatedTime: new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        
        // Metadata
        createdAt: bookingData.createdAtUTC || '',
        status: bookingData.status || 'pending',
        frontendUrl: frontendUrl,
        
        // Email data structure (sẽ được N8N prepare email function xử lý)
        // Gửi thêm để tương thích với template cũ
        emailData: {
            fullName: bookingData.fullName || bookingData.full_name || '',
            bookingCode: bookingData.submissionId || bookingData.id,
            submissionId: bookingData.submissionId || bookingData.id,
            department: bookingData.department || '',
            doctor: bookingData.doctor || bookingData.doctor_name || '',
            appointment_date: appointmentDate,
            appointment_date_formatted: formatDate(appointmentDate),
            appointment_time: appointmentTime,
            reason: bookingData.note || bookingData.reason || '',
            notes: bookingData.note || bookingData.reason || '',
            changes: changes,
            bookingUrl: `${frontendUrl}/booking/${bookingData.submissionId || bookingData.id}`,
            cancelUrl: `${frontendUrl}/booking/${bookingData.submissionId || bookingData.id}`,
            checkInUrl: `${frontendUrl}/check-in/${bookingData.submissionId || bookingData.id}`,
            phoneNumber: config.support.phone,
            supportEmail: config.support.email,
            clinicAddress: config.support.address,
            mapUrl: config.support.mapUrl,
            logoUrl: config.support.logoUrl,
        }
    };
    
    try {
        const r = await axios.post(url, payload, { 
            headers,
            timeout: 15000 
        });
        console.log('✅ Update booking email sent successfully');
        return r.data;
    } catch (err) {
        console.error('❌ Error sending update booking email to N8N:', err.message);
        if (err.response) {
            console.error('❌ Response status:', err.response.status);
            console.error('❌ Response data:', err.response.data);
        }
        // Không throw error để không ảnh hưởng đến flow chính
        return null;
    }
};

