import app from './app.js';
import { config } from './config/env.js';
import scheduledTasks from './infrastructure/jobs/scheduledTasks.js';

const port = config.port || 5000;

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 API Base URL: http://localhost:${port}`);
    console.log(`🏥 Healthcare CSKH System Ready`);
    
    // Start cron jobs
    scheduledTasks.start();
    console.log('⏰ Scheduled tasks initialized');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    scheduledTasks.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    scheduledTasks.stop();
    process.exit(0);
});