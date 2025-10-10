import BackblazeB2 from 'backblaze-b2';
import { config } from './env.js';

let initialized = false;
let b2 = null;

if (config.backblaze?.keyId && config.backblaze?.appKey && config.backblaze?.bucketId) {
    try {
        b2 = new BackblazeB2({
            applicationKeyId: config.backblaze.keyId,
            applicationKey: config.backblaze.appKey,
        });

        initialized = true;
        console.log('💾 Backblaze B2 client initialized');
    } catch (err) {
        console.warn('⚠️ Failed to initialize Backblaze B2 client:', err.message);
    }
} else {
    console.warn('⚠️ Missing Backblaze credentials — check your .env or config files');
}

export const backblaze = b2;
export const backblazeInitialized = initialized;