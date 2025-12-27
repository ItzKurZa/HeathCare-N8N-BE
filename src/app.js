import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';

import bookingRoutes from './interfaces/routes/booking.routes.js';
import fileRoutes from './interfaces/routes/file.routes.js';
import accountRoutes from './interfaces/routes/account.routes.js';
import chatbotRoutes from './interfaces/routes/chatbot.routes.js';
import adminRoutes from './interfaces/routes/admin.routes.js';
import doctorRoutes from './interfaces/routes/doctor.routes.js';
import webhookRoutes from './interfaces/routes/webhook.routes.js';
import assetsRoutes from './interfaces/routes/assets.routes.js';
import { errorHandler } from './infrastructure/middlewares/errorHandler.js';
import surveyRoutes from './interfaces/routes/survey.routes.js';
import emailRoutes from './interfaces/routes/email.routes.js';
import aiRoutes from './interfaces/routes/ai.routes.js';
import alertRoutes from './interfaces/routes/alert.routes.js';
import voiceCallRoutes from './interfaces/routes/voicecall.routes.js';
import appointmentsRoutes from './interfaces/routes/appointments.routes.js';

const app = express();

// const corsOptions = {
//   methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
//   optionsSuccessStatus: 204,
// };

// CORS cho mọi request (kể cả OPTIONS)
app.use(cors());

/**
 * Handler chung cho preflight
 * - cors() phía trên đã set đầy đủ CORS headers
 * - ở đây chỉ cần trả 204 cho mọi OPTIONS
 */
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/api/booking', bookingRoutes);
app.use('/api/medical-files', fileRoutes);
app.use('/api/medical', fileRoutes); // Keep for backward compatibility
app.use('/api/profile', bookingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/assets', assetsRoutes); // Public assets (logo, images, etc.)
app.use('/api/surveys', surveyRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/voice-calls', voiceCallRoutes);
app.use('/api/appointments', appointmentsRoutes);

// middleware xử lý lỗi
app.use(errorHandler);

export default app;
