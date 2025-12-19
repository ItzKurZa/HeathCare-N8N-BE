import { firebaseAdmin, firestore } from '../../config/firebase.js';

export const createUser = async ({ email, password, fullname, phone, cccd }) => {
    if (!firebaseAdmin || !firebaseAdmin.auth)
        throw new Error('Firebase Admin not initialized');

    const userRecord = await firebaseAdmin.auth().createUser({
        email,
        password,
        fullname: fullname || '',
        phoneNumber: phone || '',
        cccd: cccd || '',
    });

    const userData = {
        uid: userRecord.uid,
        email,
        fullname,
        phone,
        cccd,
        createdAt: new Date(),
    };

    if (firestore) {
        await firestore.collection('users').doc(userRecord.uid).set(userData, { merge: true });
    }
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
        await firebaseAdmin.auth().revokeRefreshTokens(uid);

        const user = await firebaseAdmin.auth().getUser(uid);
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

// [THÊM MỚI] Hàm tạo booking trong Firestore
export const createBookingInFirestore = async (bookingData) => {
    if (!firestore) throw new Error('Firestore not initialized');
    
    // Tạo document mới trong collection 'bookings'
    // Sử dụng add() để để Firestore tự sinh ID, hoặc doc().set() nếu bạn tự tạo ID
    const docRef = await firestore.collection('bookings').add({
        ...bookingData,
        status: 'pending', // Trạng thái ban đầu
        createdAt: new Date()
    });

    return { id: docRef.id, ...bookingData };
};

// [THÊM MỚI] Hàm cập nhật booking (dùng cho Webhook N8N sau này)
export const updateBookingInFirestore = async (bookingId, updateData) => {
    if (!firestore) throw new Error('Firestore not initialized');
    await firestore.collection('bookings').doc(bookingId).update(updateData);
    return { id: bookingId, ...updateData };
};

// [THÊM MỚI] Lấy danh sách booking của user
export const getBookingsByUserId = async (userId) => {
    if (!firestore) return [];
    const snapshot = await firestore.collection('bookings')
        .where('user_id', '==', userId)
        .orderBy('createdAt', 'desc') // Sắp xếp mới nhất trước
        .get();
        
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// [THÊM MỚI] Lấy danh sách hồ sơ bệnh án
export const getMedicalFilesByUserId = async (userId) => {
    if (!firestore) return [];
    const snapshot = await firestore.collection('medical_files') // Giả định tên collection là medical_files
        .where('user_id', '==', userId)
        .orderBy('uploaded_at', 'desc')
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getDepartmentsAndDoctorsFromFirestore = async () => {
    if (!firestore) return { departments: [], doctors: [] };

    try {
        const deptSnapshot = await firestore.collection('departments').get();
        
        const departments = deptSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const doctorsPromises = departments.map(async (dept) => {
            const docSnapshot = await firestore
                .collection('departments')
                .doc(dept.id)
                .collection('doctors')
                .get();

            return docSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                department_id: dept.id
            }));
        });

        const doctorsArrays = await Promise.all(doctorsPromises);
        const doctors = doctorsArrays.flat();

        return { departments, doctors };
    } catch (error) {
        console.error("Error fetching nested data:", error);
        return { departments: [], doctors: [] };
    }
};

export const seedDatabase = async () => {
    if (!firestore) return;

    console.log("Starting seeding nested data...");

    const deptRef1 = await firestore.collection('departments').add({ 
        name: 'General Medicine', 
        description: 'General health check up' 
    });
    await deptRef1.collection('doctors').add({ name: 'Dr. John Smith', available: true });
    await deptRef1.collection('doctors').add({ name: 'Dr. Anna White', available: true });

    const deptRef2 = await firestore.collection('departments').add({ 
        name: 'Cardiology', 
        description: 'Heart and blood vessels' 
    });
    await deptRef2.collection('doctors').add({ name: 'Dr. Sarah Johnson', available: true });

    const deptRef3 = await firestore.collection('departments').add({ 
        name: 'Pediatrics', 
        description: 'Medical care for infants, children' 
    });
    await deptRef3.collection('doctors').add({ name: 'Dr. Emily Davis', available: true });
    await deptRef3.collection('doctors').add({ name: 'Dr. Michael Brown', available: true });
    
    console.log("Database seeded with nested structure successfully!");
};