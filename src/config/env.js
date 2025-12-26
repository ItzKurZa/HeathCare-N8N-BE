import dotenv from 'dotenv';
dotenv.config();

/**
 * Tự động lấy frontend URL dựa trên môi trường
 * - Nếu local (development): sử dụng localhost với port từ env hoặc mặc định 5173
 * - Nếu production: sử dụng FRONTEND_URL từ env
 * @returns {string} Frontend URL
 */
export const getFrontendUrl = () => {
    // Nếu có FRONTEND_URL được set rõ ràng, ưu tiên dùng nó
    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '') {
        return process.env.FRONTEND_URL;
    }

    // Nếu đang ở môi trường development hoặc không có FRONTEND_URL
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    if (isDevelopment) {
        const localPort = process.env.FRONTEND_PORT || '5173';
        const localProtocol = process.env.FRONTEND_PROTOCOL || 'http';
        return `${localProtocol}://localhost:${localPort}`;
    }

    // Fallback: dùng từ config hoặc giá trị mặc định
    return process.env.FRONTEND_URL || 'https://kurza.id.vn';
};

export const config = {
    port: process.env.PORT,
    frontendUrl: process.env.FRONTEND_URL,
    n8n: {
        booking: process.env.N8N_WEBHOOK_BOOKING,
        medical: process.env.N8N_WEBHOOK_MEDICAL_UPLOAD,
        fetch: process.env.N8N_WEBHOOK_FETCH,
        chatSend: process.env.N8N_WEBHOOK_CHAT_SEND,
        departmentsDoctors: process.env.N8N_WEBHOOK_DEPARTMENTS_DOCTORS,
        cancelBooking: process.env.N8N_WEBHOOK_CANCEL_BOOKING,
        updateBooking: process.env.N8N_WEBHOOK_UPDATE_BOOKING,
        webhookSurvey: process.env.N8N_WEBHOOK_SURVEY,
    },
    firebase: {
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        apiKey: process.env.FIREBASE_API_KEY,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    },
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
        senderEmail: process.env.SENDER_EMAIL,
        cskhEmail: process.env.CSKH_EMAIL,
    },
    elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY,
        agentId: process.env.ELEVENLABS_AGENT_ID,
    },
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
    },
    survey: {
        baseUrl: process.env.SURVEY_BASE_URL,
    },
    support: {
        phone: process.env.SUPPORT_PHONE || '84+379373619',
        email: process.env.SUPPORT_EMAIL || 'anantoto1234@gmail.com',
        address: process.env.CLINIC_ADDRESS || '123 Đường ABC, Quận XYZ, TP.Đà Nẵng',
        mapUrl: process.env.MAP_URL || '',
        logoUrl: process.env.LOGO_URL || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8e57QJvOIgskjdk3BXdryire2l0RocLfRhQ&s',
    },
    backblaze: {
        keyId: process.env.BACKBLAZE_KEY_ID,
        appKey: process.env.BACKBLAZE_APP_KEY,
        bucketId: process.env.BACKBLAZE_BUCKET_ID,
        bucketName: process.env.BACKBLAZE_BUCKET_NAME,
        downloadBaseUrl: process.env.BACKBLAZE_DOWNLOAD_BASE_URL,
        isPrivateBucket: process.env.BACKBLAZE_IS_PRIVATE_BUCKET,
        tempUrlDuration: process.env.BACKBLAZE_TEMP_URL_DURATION,
    },
};