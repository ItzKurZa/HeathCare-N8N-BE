import { getUserProfile, getDoctorCatalogByUserId } from '../../infrastructure/services/firebase.services.js';
import { requireFields } from '../../utils/validate.js';

export const getUserProfileData = async ({ uid }) => {
    requireFields({ uid }, ['uid']);
    const result = await getUserProfile(uid);
    
    // Nếu user là doctor, lấy thêm thông tin từ doctors_catalog
    if (result && result.role === 'doctor' && result.uid) {
        try {
            const doctorCatalog = await getDoctorCatalogByUserId(result.uid);
            if (doctorCatalog) {
                // Merge thông tin từ catalog vào profile
                result.doctor_name = result.doctor_name || doctorCatalog.doctor;
                result.department = result.department || doctorCatalog.department;
                // Có thể thêm các thông tin khác từ catalog nếu cần
            }
        } catch (error) {
            console.warn('⚠️ Error fetching doctor catalog:', error.message);
            // Không throw error, chỉ log warning
        }
    }
    
    return result;
};