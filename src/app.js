import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';

// Routes cho 3 luồng N8N CSKH
import surveyRoutes from './interfaces/routes/survey.routes.js';
import voiceCallRoutes from './interfaces/routes/voicecall.routes.js';
import emailRoutes from './interfaces/routes/email.routes.js';
import aiRoutes from './interfaces/routes/ai.routes.js';
import alertRoutes from './interfaces/routes/alert.routes.js';
import appointmentsRoutes from './interfaces/routes/appointments.routes.js';
import { errorHandler } from './infrastructure/middlewares/errorHandler.js';

const app = express();

const allowedOrigins = [
    config.frontendUrl, // domain thật (https://kurza.id.vn)
    "http://localhost:5173", // dev local
    "http://localhost:8000", // test server
    "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--96435430.local-credentialless.webcontainer-api.io", // webcontainer
    "null", // Allow file:// protocol for local testing
];

// CORS configuration - allow all origins in development
const corsOptions = {
    origin: true, // Allow all origins
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        service: 'Healthcare CSKH API'
    });
});

// ============================================
// ROUTES CHO 3 LUỒNG N8N CSKH
// ============================================

// Flow 1: Survey Send - Lấy appointments đã hoàn thành
app.use('/api/appointments', appointmentsRoutes);

// Flow 1 & 2: Survey - Gửi và xử lý khảo sát
app.use('/api/surveys', surveyRoutes);

// Flow 1 & 2: Email - Gửi email khảo sát
app.use('/api/emails', emailRoutes);

// Flow 2: AI Analysis - Phân tích phản hồi
app.use('/api/ai', aiRoutes);

// Flow 2 & 3: Alerts - Gửi cảnh báo CSKH
app.use('/api/alerts', alertRoutes);

// Flow 3: Voice Call - Xử lý webhook voice
app.use('/api/voice-calls', voiceCallRoutes);
app.use('/api/voicecall', voiceCallRoutes); // Alias for n8n compatibility

app.use(errorHandler);

export default app;