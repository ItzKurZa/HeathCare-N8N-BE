import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 5000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    n8n: {
        booking: process.env.N8N_WEBHOOK_BOOKING,
        medical: process.env.N8N_WEBHOOK_MEDICAL,
        fetch: process.env.N8N_WEBHOOK_FETCH,
        chatSend: process.env.N8N_WEBHOOK_CHAT_SEND,
        chatHistory: process.env.N8N_WEBHOOK_CHAT_HISTORY,
    },
    firebase: {
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        apiKey: process.env.FIREBASE_API_KEY,
    }
};