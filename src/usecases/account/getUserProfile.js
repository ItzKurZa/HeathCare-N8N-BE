import { getUserProfile, getDoctorCatalogByUserId } from '../../infrastructure/services/firebase.services.js';
import { requireFields } from '../../utils/validate.js';
import { firestore } from '../../config/firebase.js';

export const getUserProfileData = async ({ uid }) => {
    requireFields({ uid }, ['uid']);
    const result = await getUserProfile(uid);
    
    // Nếu user là doctor, lấy thêm thông tin từ doctors_catalog, departments và tính thống kê
    if (result && result.role === 'doctor' && result.uid) {
        console.log(`[getUserProfileData] Processing doctor profile for uid: ${result.uid}`);
        try {
            const doctorCatalog = await getDoctorCatalogByUserId(result.uid);
            console.log(`[getUserProfileData] Doctor catalog found:`, doctorCatalog ? 'Yes' : 'No');
            
            // Merge thông tin từ catalog vào profile (nếu có)
            if (doctorCatalog) {
                result.doctor_name = result.doctor_name || doctorCatalog.doctor;
                result.department = result.department || doctorCatalog.department;
                result.departmentId = result.departmentId || doctorCatalog.departmentId;
                result.doctor_status = doctorCatalog.status; // Status trong catalog
                result.doctor_catalog_id = doctorCatalog.id;
                
                // Lấy thông tin department nếu có departmentId
                if (doctorCatalog.departmentId && firestore) {
                    try {
                        const deptDoc = await firestore.collection('departments').doc(doctorCatalog.departmentId).get();
                        if (deptDoc.exists) {
                            const deptData = deptDoc.data();
                            result.department_info = {
                                id: deptData.id,
                                name: deptData.name,
                                description: deptData.description,
                            };
                        }
                    } catch (deptError) {
                        console.warn('⚠️ Error fetching department info:', deptError.message);
                    }
                }
            } else {
                // Nếu không có trong catalog, vẫn set các giá trị từ user profile
                console.log(`[getUserProfileData] No catalog found, using user profile data`);
                result.doctor_name = result.doctor_name || result.fullname || 'Chưa cập nhật';
                result.doctor_status = 'inactive'; // Mặc định inactive nếu không có trong catalog
                
                // Giữ nguyên department từ user profile nếu có
                // result.department = result.department || null; // Đã có sẵn từ getUserProfile
                
                // Nếu có departmentId trong user profile, lấy thông tin department
                if (result.departmentId && firestore) {
                    try {
                        const deptDoc = await firestore.collection('departments').doc(result.departmentId).get();
                        if (deptDoc.exists) {
                            const deptData = deptDoc.data();
                            result.department = result.department || deptData.name; // Lấy department name từ departments collection
                            result.department_info = {
                                id: deptData.id,
                                name: deptData.name,
                                description: deptData.description,
                            };
                            console.log(`[getUserProfileData] Department info loaded from departments collection:`, result.department_info);
                        }
                    } catch (deptError) {
                        console.warn('⚠️ Error fetching department info:', deptError.message);
                    }
                } else if (result.department) {
                    // Nếu có department name nhưng không có departmentId, thử tìm departmentId
                    console.log(`[getUserProfileData] Has department name but no departmentId, searching...`);
                    try {
                        const deptSnap = await firestore
                            .collection('departments')
                            .where('name', '==', result.department)
                            .limit(1)
                            .get();
                        
                        if (!deptSnap.empty) {
                            const deptData = deptSnap.docs[0].data();
                            result.departmentId = deptSnap.docs[0].id;
                            result.department_info = {
                                id: deptSnap.docs[0].id,
                                name: deptData.name,
                                description: deptData.description,
                            };
                            console.log(`[getUserProfileData] Found departmentId by name:`, result.departmentId);
                        }
                    } catch (deptError) {
                        console.warn('⚠️ Error searching department by name:', deptError.message);
                    }
                }
            }

            // Tính thống kê từ appointments (luôn tính, không phụ thuộc vào catalog)
            try {
                const doctorName = result.doctor_name || result.fullname;
                if (doctorName && firestore) {
                    // Lấy tất cả appointments của doctor này
                    const appointmentsSnap = await firestore
                        .collection('appointments')
                        .where('doctor', '==', doctorName)
                        .get();

                    const uniquePatients = new Set();
                    let totalBookings = 0;
                    let completedBookings = 0;
                    let pendingBookings = 0;
                    let confirmedBookings = 0;
                    let cancelledBookings = 0;

                    appointmentsSnap.forEach((doc) => {
                        const data = doc.data();
                        totalBookings++;

                        // Count unique patients
                        if (data.email) uniquePatients.add(data.email);
                        else if (data.phone) uniquePatients.add(data.phone);

                        // Count by status
                        const status = (data.status || '').toLowerCase();
                        switch (status) {
                            case 'completed':
                                completedBookings++;
                                break;
                            case 'pending':
                                pendingBookings++;
                                break;
                            case 'confirmed':
                                confirmedBookings++;
                                break;
                            case 'cancelled':
                            case 'canceled':
                                cancelledBookings++;
                                break;
                        }
                    });

                    result.statistics = {
                        totalBookings,
                        totalPatients: uniquePatients.size,
                        completedBookings,
                        pendingBookings,
                        confirmedBookings,
                        cancelledBookings,
                    };
                    console.log(`[getUserProfileData] Statistics calculated:`, result.statistics);
                } else {
                    // Set default statistics nếu không có doctor name
                    console.log(`[getUserProfileData] No doctor name, setting default statistics`);
                    result.statistics = {
                        totalBookings: 0,
                        totalPatients: 0,
                        completedBookings: 0,
                        pendingBookings: 0,
                        confirmedBookings: 0,
                        cancelledBookings: 0,
                    };
                }
            } catch (statsError) {
                console.warn('⚠️ Error calculating doctor statistics:', statsError.message);
                // Set default statistics
                result.statistics = {
                    totalBookings: 0,
                    totalPatients: 0,
                    completedBookings: 0,
                    pendingBookings: 0,
                    confirmedBookings: 0,
                    cancelledBookings: 0,
                };
            }
        } catch (error) {
            console.warn('⚠️ Error fetching doctor catalog:', error.message);
            console.warn('⚠️ Error stack:', error.stack);
            // Vẫn set default values ngay cả khi có lỗi
            result.doctor_name = result.doctor_name || result.fullname || 'Chưa cập nhật';
            result.doctor_status = 'inactive';
            result.statistics = {
                totalBookings: 0,
                totalPatients: 0,
                completedBookings: 0,
                pendingBookings: 0,
                confirmedBookings: 0,
                cancelledBookings: 0,
            };
        }
        console.log(`[getUserProfileData] Final result for doctor:`, {
            doctor_name: result.doctor_name,
            department: result.department,
            doctor_status: result.doctor_status,
            has_statistics: !!result.statistics,
        });
    }
    
    return result;
};