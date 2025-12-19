import { getUserProfile, getBookingsByUserId, getMedicalFilesByUserId } from '../../infrastructure/services/firebase.services.js';

export const fetchProfileData = async ({ userId }) => {
    if (!userId) throw new Error("User ID is required");

    // Sử dụng Promise.all để chạy song song 3 tác vụ -> Tốc độ nhanh hơn
    const [userProfile, bookings, medicalFiles] = await Promise.all([
        getUserProfile(userId),
        getBookingsByUserId(userId),
        getMedicalFilesByUserId(userId)
    ]);

    if (!userProfile) {
        throw new Error("User not found");
    }

    // Trả về cấu trúc dữ liệu tổng hợp
    return {
        user: userProfile,
        bookings: bookings || [],
        medical_files: medicalFiles || []
    };
};