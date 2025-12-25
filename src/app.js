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

const app = express();

const allowedOrigins = [
  config.frontendUrl, // https://kurza.id.vn
  'http://localhost:5173', // dev local
  'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--96435430.local-credentialless.webcontainer-api.io', // webcontainer
];

const corsOptions = {
  origin(origin, callback) {
    // Cho phép request không có origin (Postman, curl,…)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (!allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

// CORS cho mọi request (kể cả OPTIONS)
app.use(cors(corsOptions));

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

// middleware xử lý lỗi
app.use(errorHandler);

export default app;
