import app from './app.js';
import { config } from './config/env.js';
import scheduledTasks from './infrastructure/jobs/scheduledTasks.js';

const port = config.port || 5002;

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    
    scheduledTasks.start();
    console.log('⏰ CSKH Scheduled tasks initialized');
});