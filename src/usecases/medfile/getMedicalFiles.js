// src/usecases/medfile/getAllMedicalFiles.js
import { getAllMedicalFilesFromFirestore } from '../../infrastructure/services/firebase.services.js';

export const getAllMedicalFiles = async () => {
    // Hiện tại cho phép Admin/Doctor xem hết để phục vụ demo dashboard
    // Sau này có thể thêm filter tương tự booking
    return await getAllMedicalFilesFromFirestore();
};