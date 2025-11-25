import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';

import bookingRoutes from './interfaces/routes/booking.routes.js';
import fileRoutes from './interfaces/routes/file.routes.js';
import accountRoutes from './interfaces/routes/account.routes.js';
import chatbotRoutes from './interfaces/routes/chatbot.routes.js';
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
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        service: 'Healthcare CSKH API'
    });
});

// Existing routes
app.use('/api/booking', bookingRoutes);
app.use('/api/medical', fileRoutes);
app.use('/api/profile', bookingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/chatbot', chatbotRoutes);

// New CSKH routes
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/voice-calls', voiceCallRoutes);
app.use('/api/voice', voiceCallRoutes); // Alias for n8n compatibility
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/stats', appointmentsRoutes); // Stats endpoints

app.use(errorHandler);

export default app;