import { sendMedicalFile } from '../../infrastructure/services/n8n.service.js';

export const sendMedicalFileToN8n = async ({ fields, file }) => {
    if (!file) throw new Error('File required');
    // bạn có thể validate mimeType, kích thước ... ở đây
    const result = await sendMedicalFile({ fields, file });
    return result;
};