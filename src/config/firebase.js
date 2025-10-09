import admin from 'firebase-admin';
import { config } from './env.js';

let initialized = false;
let serviceAccount = null;

if (config.firebase.serviceAccountJson) {
    try {
        serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
    } catch (err) {
        console.warn('FIREBASE_SERVICE_ACCOUNT_JSON parse error: ', err.message);
    }
} else if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    serviceAccount = {
        project_id: config.firebase.projectId,
        client_email: config.firebase.clientEmail,
        private_key: config.firebase.privateKey.replace(/\n/g, '\n'),
    };
}

if (serviceAccount) {
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        initialized = true;
    }
}

export const firebaseAdmin = admin;
export const firestore = initialized ? admin.firestore() : null;

if (firestore) {
    firestore.settings({ ignoreUndefinedProperties: true });
    console.log('🔥 Firestore initialized with ignoreUndefinedProperties = true');
} else {
    console.warn('⚠️ Firestore not initialized — check your Firebase credentials');
}