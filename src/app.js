import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';

import bookingRoutes from './interfaces/routes/booking.routes.js';
import fileRoutes from './interfaces/routes/file.routes.js';
import accountRoutes from './interfaces/routes/account.routes.js';
import { errorHandler } from './infrastructure/middlewares/errorHandler.js';

const app = express();

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.use('/api/booking', bookingRoutes);
app.use('/api/medical', fileRoutes);
// app.use('/api/profile', bookingRoutes); // GET /api/profile/:userId handled in booking.routes
app.use('/api/account', accountRoutes);

app.use(errorHandler);

export default app;