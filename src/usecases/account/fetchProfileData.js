import { getPatientProfile, getBookingsByUserId, getMedicalFilesByUserId } from '../../infrastructure/services/firebase.services.js';

export const fetchProfileData = async ({ userId }) => {
    if (!userId) throw new Error("User ID is required");

    const [userProfile, bookings, medicalFiles] = await Promise.all([
        getPatientProfile(userId),
        getBookingsByUserId(userId),
        getMedicalFilesByUserId(userId)
    ]);

    if (!userProfile) {
        throw new Error("User not found");
    }

    return {
        user: userProfile,
        bookings: bookings || [],
        medical_files: medicalFiles || []
    };
};