import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';

import bookingRoutes from './interfaces/routes/booking.routes.js';
import fileRoutes from './interfaces/routes/file.routes.js';
import accountRoutes from './interfaces/routes/account.routes.js';
import chatbotRoutes from './interfaces/routes/chatbot.routes.js';
import { errorHandler } from './infrastructure/middlewares/errorHandler.js';

const app = express();

const allowedOrigins = [
    config.frontendUrl, // domain thật (https://kurza.id.vn)
    "https://orange-space-yodel-x5xjx4pv5p4q2pjp6-5173.app.github.dev/",
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/booking', bookingRoutes);
app.use('/api/medical', fileRoutes);
app.use('/api/profile', bookingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.use(errorHandler);

export default app;