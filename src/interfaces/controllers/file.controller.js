import { sendMedicalFileToN8nAndCloud } from '../../usecases/medfile/uploadMedicalFile.js';
import {
    saveMedicalFileMetadata,
    getUserFilesService,
    deleteFileService,
} from '../../infrastructure/services/firebase.services.js';
import { deleteFileFromBackblaze } from '../../infrastructure/services/backblaze.services.js';
import { v4 as uuid } from 'uuid';

export const uploadMedical = async (req, res, next) => {
    try {
        const file = req.file;
        const fields = req.body;
        const result = await sendMedicalFileToN8nAndCloud({ fields, file });

        // Lưu metadata vào Firestore
        const fileMetadata = {
            id: uuid(),
            user_id: fields.userId || fields.user_id,
            file_name: file.originalname,
            file_url: result.fileUrl,
            b2_id: result.fileId,
            file_type: file.mimetype,
            file_size: file.size,
            description: fields.notes || fields.description || '',
            summary: result.n8nResult.summary,
            uploaded_at: new Date().toISOString(),
        };

        await saveMedicalFileMetadata(fileMetadata);

        res.status(200).json({
            success: true,
            file: fileMetadata
        });
    } catch (err) {
        next(err);
    }
};

export const getUserFiles = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const files = await getUserFilesService(userId);

        res.status(200).json({
            success: true,
            files,
        });
    } catch (err) {
        next(err);
    }
};

export const deleteFile = async (req, res, next) => {
    try {
        const { file_name, fileId, b2_id } = req.params;
        await deleteFileService(fileId);
        await deleteFileFromBackblaze(file_name, b2_id);

        res.status(200).json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};