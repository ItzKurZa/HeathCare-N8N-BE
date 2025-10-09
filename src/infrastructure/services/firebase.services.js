import { firebaseAdmin, firestore } from '../../config/firebase.js';

// export const createUser = async ({ email, password, displayName }) => {
//     if (!firebaseAdmin || !firebaseAdmin.auth) throw new Error('Firebase Admin not initialized');
//     const userRecord = await firebaseAdmin.auth().createUser({ email, password, displayName });
//     if (firestore) {
//         await firestore.collection('users').doc(userRecord.uid).set({
//             email,
//             displayName,
//             createdAt: Date.now(),
//         });
//     }
//     const customToken = await firebaseAdmin.auth().createCustomToken(userRecord.uid);
//     return { uid: userRecord.uid, customToken };
// };

import { cleanUndefined } from '../../utils/cleanUndefined.js';

export const createUser = async ({ email, password, displayName }) => {
    if (!firebaseAdmin || !firebaseAdmin.auth)
        throw new Error('Firebase Admin not initialized');

    // 1️⃣ Tạo user trong Firebase Authentication
    const userRecord = await firebaseAdmin.auth().createUser({
        email,
        password,
        displayName: displayName || '', // tránh undefined
    });

    // 2️⃣ Chuẩn bị dữ liệu Firestore (lọc bỏ undefined)
    const userData = cleanUndefined({
        uid: userRecord.uid,
        email,
        displayName,
        createdAt: new Date(), // kiểu Date object
    });

    // 3️⃣ Lưu vào Firestore nếu có
    if (firestore) {
        await firestore.collection('users').doc(userRecord.uid).set(userData);
    }

    // 4️⃣ Tạo custom token để frontend đăng nhập ngay sau khi signup
    const customToken = await firebaseAdmin
        .auth()
        .createCustomToken(userRecord.uid);

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

export const signOutUser = async (uid) => {
    try {
        await admin.auth().revokeRefreshTokens(uid);

        const user = await admin.auth().getUser(uid);
        const tokensValidAfterTime = new Date(user.tokensValidAfterTime).getTime() / 1000;
        return {
            success: true,
            message: 'User signed out successfully (tokens revoked)',
            tokensValidAfter: tokensValidAfterTime,
        };
    } catch (error) {
        console.error('Sign-out error:', error);
        throw new Error('Error signing out user');
    }
};