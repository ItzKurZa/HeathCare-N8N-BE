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

    // Tách uid ra để dùng làm Document ID cha, phần còn lại lưu vào Sub-collection
    const { uid, ...dataToSave } = bookingData;

    if (!uid) throw new Error('User ID (uid) is required to create booking');

    // Cấu trúc: Bookings (Col) -> uid (Doc) -> Books (Sub-Col) -> AutoID (Doc)
    const docRef = await firestore
        .collection('Bookings')
        .doc(uid)
        .collection('Books')
        .add({
            ...dataToSave,
            status: 'pending',
            createdAt: new Date()
        });

    // Trả về dữ liệu bao gồm cả id mới tạo và uid
    return { id: docRef.id, uid, ...dataToSave };
};

// [THÊM MỚI] Hàm cập nhật booking (dùng cho Webhook N8N sau này)
export const updateBookingInFirestore = async (bookingId, updateData, userId) => {
    if (!firestore) throw new Error('Firestore not initialized');

    // Nếu không có userId, chúng ta không thể tìm thấy đường dẫn (trừ khi dùng Collection Group Query - phức tạp hơn)
    if (!userId) {
        // Fallback: Nếu hệ thống cũ gọi mà không có userId, bạn có thể cần logic xử lý khác
        // Nhưng tốt nhất nên truyền userId từ UseCase xuống
        throw new Error('UserId is required to update booking in nested structure');
    }

    await firestore
        .collection('Bookings')
        .doc(userId)
        .collection('Books')
        .doc(bookingId)
        .update(updateData);

    return { id: bookingId, ...updateData };
};

export const getBookingsByUserId = async (userId) => {
    if (!firestore) return [];

    // Truy vấn trực tiếp vào Sub-collection của User đó
    const snapshot = await firestore
        .collection('Bookings')
        .doc(userId)
        .collection('Books')
        .orderBy('createdAt', 'desc')
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveMedicalFile = async (userId, fileData) => {
    if (!firestore) throw new Error("Firestore not initialized");

    try {
        const fileRef = await firestore
            .collection('MedicalFiles')
            .doc(userId)
            .collection('Files')
            .add({
                fileName: fileData.fileName,
                Link: fileData.link,
                Summary: fileData.summary || '',
                UploadDate: new Date(),
                fileId: fileData.fileId,
                mimeType: fileData.mimeType
            });

        return { id: fileRef.id, ...fileData };
    } catch (error) {
        console.error("Error saving medical file metadata:", error);
        throw new Error("Could not save file metadata to Firestore");
    }
};

export const getMedicalFilesByUserId = async (userId) => {
    if (!firestore) return [];

    try {
        const snapshot = await firestore
            .collection('MedicalFiles') // Collection cha
            .doc(userId)                // Document User
            .collection('Files')        // Sub-collection Files
            .orderBy('UploadDate', 'desc') // Sắp xếp theo ngày upload
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            UploadDate: doc.data().UploadDate?.toDate ? doc.data().UploadDate.toDate() : doc.data().UploadDate
        }));
    } catch (error) {
        console.error("Error fetching user files:", error);
        return [];
    }
};

export const getMedicalFileById = async (userId, fileId) => {
    const doc = await firestore
        .collection('MedicalFiles')
        .doc(userId)
        .collection('Files')
        .doc(fileId)
        .get();
    return doc.exists ? doc.data() : null;
};

export const deleteMedicalFileFromFirestore = async (userId, fileId) => {
    await firestore
        .collection('MedicalFiles')
        .doc(userId)
        .collection('Files')
        .doc(fileId)
        .delete();
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