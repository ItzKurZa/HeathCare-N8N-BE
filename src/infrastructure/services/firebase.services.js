import { firebaseAdmin, firestore } from '../../config/firebase.js';

export const createUser = async ({ email, password, displayName }) => {
    if (!firebaseAdmin || !firebaseAdmin.auth) throw new Error('Firebase Admin not initialized');
    const userRecord = await firebaseAdmin.auth().createUser({ email, password, displayName });
    if (firestore) {
        await firestore.collection('users').doc(userRecord.uid).set({
            email,
            displayName,
            createdAt: Date.now(),
        });
    }
    const customToken = await firebaseAdmin.auth().createCustomToken(userRecord.uid);
    return { uid: userRecord.uid, customToken };
};

export const getUserProfile = async (uid) => {
    if (!firestore) return null;
    const doc = await firestore.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
};

export const verifyIdToken = async (idToken) => {
    if (!firebaseAdmin || !firebaseAdmin.auth) throw new Error('Firebase Admin not initialized');
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    return decoded;
};