import { firebaseAdmin, firestore } from '../../config/firebase.js';

export const createUser = async ({ email, password, fullname, phone, cccd, role, departmentId }) => {
    if (!firebaseAdmin || !firebaseAdmin.auth)
        throw new Error('Firebase Admin not initialized');

    const userRecord = await firebaseAdmin.auth().createUser({
        email,
        password,
        fullname: fullname || '',
        phoneNumber: phone || '',
        cccd: cccd || '',
    });

    const actualRole = role === 'admin' ? 'Admin' : (role === 'doctors' ? 'Doctor' : (role === 'nurses' ? 'Nurse' : 'Staff'));

    const userData = {
        uid: userRecord.uid,
        email,
        name: fullname,
        phone,
        cccd,
        role: actualRole,
        createdAt: new Date(),
    };

    const validDeptId = (typeof departmentId === 'string') ? departmentId : null;

    if (firestore) {
        // Kiểm tra departmentId có giá trị hợp lệ và không phải 'admin'
        if (departmentId && departmentId !== "" && role !== 'admin') {
            await firestore
                .collection('departments')
                .doc(validDeptId)
                .collection(role)
                .doc(userRecord.uid)
                .set(userData, { merge: true });
        } else if (role === 'admin') {
            await firestore.collection('admins').doc(userRecord.uid).set(userData, { merge: true });
        } else {
            // Trường hợp dành cho bệnh nhân hoặc khi không có khoa
            await firestore.collection('users').doc(userRecord.uid).set(userData, { merge: true });
        }
    }

    return { uid: userRecord.uid, email };
};

// [HÀM 1] Lấy thông tin Nhân viên Bệnh viện (Admin, Doctor, Nurse, Staff)
export const getHospitalStaffProfile = async (uid) => {
    if (!firestore) return null;

    try {
        // 1. Kiểm tra collection 'admins'
        const adminDoc = await firestore.collection('admins').doc(uid).get();
        if (adminDoc.exists) {
            return { ...adminDoc.data(), role: 'Admin' };
        }

        // 2. Kiểm tra trong các sub-collection của Departments (Doctor, Nurse, Staff)
        // Sử dụng Collection Group Query để tìm trong tất cả các khoa
        const roleMapping = {
            'Doctor': 'doctors',
            'Nurse': 'nurses',
            'Staff': 'staffs'
        };

        // Duyệt qua từng cặp key-value
        for (const [roleName, collectionName] of Object.entries(roleMapping)) {
            // collectionName sẽ lần lượt là 'doctors', 'nurses', 'staffs'
            const snapshot = await firestore.collectionGroup(collectionName)
                .where('uid', '==', uid)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                // Trả về dữ liệu và đảm bảo role đúng chuẩn (nếu trong DB chưa lưu role chuẩn)
                return {
                    ...doc.data(),
                    role: roleName // Gán cứng 'Doctor'/'Nurse'/'Staff' trả về cho đồng bộ
                };
            }
        }

        return null; // Không phải nhân viên bệnh viện
    } catch (error) {
        console.error('Lỗi khi lấy thông tin nhân viên:', error);
        return null;
    }
};

// [HÀM 2] Lấy thông tin Bệnh nhân (Users thông thường)
export const getPatientProfile = async (uid) => {
    if (!firestore) return null;

    try {
        const userDoc = await firestore.collection('users').doc(uid).get();
        return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
        console.error('Lỗi khi lấy thông tin bệnh nhân:', error);
        return null;
    }
};

// [HÀM TỔNG HỢP] Giữ lại hàm này để Controller hiện tại không bị lỗi
export const getUserProfile = async (uid) => {
    const patientProfile = await getPatientProfile(uid);
    if (patientProfile) {
        return patientProfile;
    }

    const staffProfile = await getHospitalStaffProfile(uid);
    return staffProfile;
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

// [THÊM MỚI] Lấy danh sách Booking có phân quyền (Collection Group Query)
// [Cập nhật] Thêm logic lấy thông tin User
export const getAllBookingsFromFirestore = async (filter = {}) => {
    if (!firestore) return [];

    try {
        console.log("🔄 Đang lấy danh sách booking từ tất cả các Collection 'Books'...");
        
        // 1. Dùng collectionGroup để quét tất cả booking trong hệ thống
        let query = firestore.collectionGroup('Books');

        // Logic bộ lọc (Giữ nguyên)
        if (filter.department) {
            query = query.where('department', '==', filter.department);
        }
        // Lưu ý: Đảm bảo field tên bác sĩ trong DB đúng là 'doctor' (hoặc sửa thành 'doctorName' nếu cần)
        if (filter.doctorName) {
            query = query.where('doctor_name', '==', filter.doctorName);
        }
        
        const snapshot = await query.get();
        
        // 2. Map dữ liệu & Trích xuất UID từ đường dẫn cha
        const rawBookings = snapshot.docs.map(doc => {
            const data = doc.data();
            
            // [QUAN TRỌNG]: Lấy UID từ data HOẶC lấy từ Document cha (User UID)
            // Cấu trúc: Bookings/{uid}/Books/{bookId}
            // doc.ref.parent = Collection 'Books'
            // doc.ref.parent.parent = Document '{uid}'
            const parentDoc = doc.ref.parent.parent;
            const uid = data.userId || data.uid || (parentDoc ? parentDoc.id : null);

            return { 
                id: doc.id, 
                uid: uid, // Luôn đảm bảo có UID
                ...data 
            };
        });

        // 3. Ghép thông tin (JOIN) với Collection 'users'
        const enrichedBookings = await Promise.all(rawBookings.map(async (booking) => {
            if (!booking.uid) {
                return { ...booking, patientName: 'Lỗi: Không tìm thấy UID' };
            }

            try {
                const userDoc = await firestore.collection('users').doc(booking.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    return {
                        ...booking,
                        patientName: userData.fullname || userData.name || userData.displayName || 'Bệnh nhân (Chưa có tên)',
                        patientPhone: userData.phone || userData.phoneNumber || '',
                        patientEmail: userData.email || ''
                    };
                }
            } catch (err) {
                console.error(`⚠️ Lỗi khi lấy user ${booking.uid}:`, err);
            }

            return { ...booking, patientName: 'Khách vãng lai / User đã xóa' };
        }));

        console.log(`✅ Đã tải ${enrichedBookings.length} lịch hẹn.`);
        return enrichedBookings;

    } catch (error) {
        console.error("❌ Lỗi getAllBookingsFromFirestore:", error);
        return [];
    }
};

// [THÊM MỚI] Lấy danh sách Medical Files (Collection Group Query)
export const getAllMedicalFilesFromFirestore = async () => {
    if (!firestore) return [];

    try {
        // Lấy tất cả file từ tất cả user
        const snapshot = await firestore.collectionGroup('Files')
            .orderBy('UploadDate', 'desc')
            .get();

        // Cần map thêm userId (là id của doc cha) để biết file của ai
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Lấy ID của document cha (User ID) từ đường dẫn reference
                userId: doc.ref.parent.parent.id,
                UploadDate: data.UploadDate?.toDate ? data.UploadDate.toDate() : data.UploadDate
            };
        });
    } catch (error) {
        console.error("Error fetching all medical files:", error);
        return [];
    }
};