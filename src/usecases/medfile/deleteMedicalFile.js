// src/usecases/medfile/deleteMedicalFile.js
import { deleteFileFromBackblaze } from '../../infrastructure/services/backblaze.services.js';
import { deleteMedicalFileFromFirestore, getMedicalFileById } from '../../infrastructure/services/firebase.services.js';

export const deleteMedicalFileUsecase = async (userId, fileId) => {
    // 1. Lấy thông tin file để có fileId của Backblaze (nativeId) và kiểm tra quyền sở hữu
    const fileData = await getMedicalFileById(userId, fileId);
    if (!fileData) throw new Error("File không tồn tại hoặc bạn không có quyền xóa");

    // 2. Xóa trên Backblaze (nếu cần xóa vật lý để tiết kiệm dung lượng)
    if (fileData.fileId) {
        await deleteFileFromBackblaze(fileData.fileName, fileData.fileId);
    }

    // 3. Xóa record trên Firestore
    await deleteMedicalFileFromFirestore(userId, fileId);
};