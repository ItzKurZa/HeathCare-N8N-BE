import { firebaseAdmin, firestore } from '../../config/firebase.js';

export const createUser = async ({ email, password, fullname, phone, cccd }) => {
    if (!firebaseAdmin || !firebaseAdmin.auth) throw new Error('Firebase Admin not initialized');
    const userRecord = await firebaseAdmin.auth().createUser({
        email, password, fullname: fullname || '', phoneNumber: phone || undefined,
    });
    const userData = {
        uid: userRecord.uid, email, fullname, phone, cccd, role: 'patient', createdAt: new Date(),
    };
    if (firestore) {
        await firestore.collection('users').doc(userRecord.uid).set(userData, { merge: true });
    }
    return userData;
};

export const getUserProfile = async (uid) => {
    if (!firestore) return null;
    const doc = await firestore.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
};

export const verifyIdToken = async (idToken) => {
    if (!firebaseAdmin || !firebaseAdmin.auth) throw new Error('Firebase Admin not initialized');
    return await firebaseAdmin.auth().verifyIdToken(idToken);
};

export const signOutUser = async (uid) => {
    try {
        await firebaseAdmin.auth().revokeRefreshTokens(uid);
        return { success: true, message: 'Signed out' };
    } catch (error) { throw error; }
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