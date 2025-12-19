// import { sendMedicalFile } from '../../infrastructure/services/n8n.services.js';
import { uploadFileToBackblaze } from '../../infrastructure/services/backblaze.services.js';
import { saveMedicalFile } from '../../infrastructure/services/firebase.services.js'; 

export const uploadMedicalFile = async (userId, file) => {
    if (!file) throw new Error('No file provided');
    if (!userId) throw new Error('User ID is required');

    try {
        const b2Result = await uploadFileToBackblaze(file);

        const fileMetadata = {
            fileName: file.originalname,
            link: b2Result.url,
            fileId: b2Result.fileId,
            mimeType: file.mimetype,
            summary: 'Đang chờ xử lý...'
        };

        const savedRecord = await saveMedicalFile(userId, fileMetadata);

        // await sendFileToN8N(savedRecord);

        return savedRecord;

    } catch (error) {
        console.error('Upload Process Failed:', error);
        throw error;
    }
};