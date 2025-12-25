import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT,
    frontendUrl: process.env.FRONTEND_URL,
    n8n: {
        booking: process.env.N8N_WEBHOOK_BOOKING,
        medical: process.env.N8N_WEBHOOK_MEDICAL_UPLOAD,
        fetch: process.env.N8N_WEBHOOK_FETCH,
        chatSend: process.env.N8N_WEBHOOK_CHAT_SEND,
        departmentsDoctors: process.env.N8N_WEBHOOK_DEPARTMENTS_DOCTORS,
        surveyWebhook: process.env.N8N_WEBHOOK_SURVEY, // Webhook nhận survey từ form
    },
    firebase: {
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        apiKey: process.env.FIREBASE_API_KEY,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
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
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
        senderEmail: process.env.SENDER_EMAIL,
        cskhEmail: process.env.CSKH_EMAIL,
    },
    elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY,
        agentId: process.env.ELEVENLABS_AGENT_ID,
        webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET,
    },
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
    },
    backend: {
        webhookUrl: process.env.BACKEND_WEBHOOK_URL || 'http://localhost:5000',
    },
    survey: {
        baseUrl: process.env.SURVEY_BASE_URL,
    },
};