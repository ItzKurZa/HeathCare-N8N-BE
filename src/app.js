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
import { errorHandler } from './infrastructure/middlewares/errorHandler.js';

const app = express();

const allowedOrigins = [
    config.frontendUrl, // domain thật (https://kurza.id.vn)
    "http://localhost:5173", // dev local
    "http://localhost:5174", // dev local (alternative port)
    "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--96435430.local-credentialless.webcontainer-api.io", // webcontainer
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/booking', bookingRoutes);
app.use('/api/medical-files', fileRoutes);
app.use('/api/medical', fileRoutes); // Keep for backward compatibility
app.use('/api/profile', bookingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/webhook', webhookRoutes);

app.use(errorHandler);

export default app;