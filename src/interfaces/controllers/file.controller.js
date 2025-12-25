import { sendMedicalFileToN8nAndCloud } from '../../usecases/medfile/uploadMedicalFile.js';
import {
    saveMedicalFileMetadata,
    getUserFilesService,
    getFileByIdService,
    deleteFileService,
} from '../../infrastructure/services/firebase.services.js';
import { deleteFileFromBackblaze } from '../../infrastructure/services/backblaze.services.js';
import { v4 as uuid } from 'uuid';

export const uploadMedical = async (req, res, next) => {
    try {
        const file = req.file;
        const fields = req.body;
        const result = await sendMedicalFileToN8nAndCloud({ fields, file });

        console.log('🔍 N8N Response Body:', JSON.stringify(result.n8nResult, null, 2));

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
            summary: result.n8nResult.output,
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
        const { fileId } = req.params;
        console.log(`[Delete] Request to delete fileId: ${fileId}`);

        const fileMetadata = await getFileByIdService(fileId);
        console.log('[Delete] Found metadata:', fileMetadata);

        if (fileMetadata.b2_id && fileMetadata.file_name) {
            try {
                await deleteFileFromBackblaze(fileMetadata.file_name, fileMetadata.b2_id);
            } catch (b2Error) {
                console.error('⚠️ Warning: Failed to delete from Backblaze, but continuing to delete from DB:', b2Error.message);
            }
        } else {
            console.warn('⚠️ File metadata missing b2_id or file_name, skipping B2 deletion');
        }

        await deleteFileService(fileId);

        res.status(200).json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};