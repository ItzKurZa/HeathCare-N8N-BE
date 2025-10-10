import { sendMedicalFile } from '../../infrastructure/services/n8n.services.js';
import { uploadFileToBackblaze } from '../../infrastructure/services/backblaze.services.js';

export const sendMedicalFileToN8nAndCloud = async ({ fields, file }) => {
    if (!file) throw new Error('File required');

    const cloudResult = await uploadFileToBackblaze(file);
    const { fileUrl } = cloudResult;

    const [n8nResult] = await Promise.all([
        sendMedicalFile({ ...fields, fileUrl }),
    ]);

    return { n8nResult, cloudResult };
};
