import { sendMedicalFile } from '../../infrastructure/services/n8n.services.js';
import { uploadFileToBackblaze } from '../../infrastructure/services/backblaze.services.js';

export const sendMedicalFileToN8nAndCloud = async ({ fields, file }) => {
  if (!file) throw new Error('File required');

  const { fileUrl } = await uploadFileToBackblaze(file);

  if (!fileUrl) throw new Error('File upload failed — fileUrl missing');

  const n8nResult = await sendMedicalFile({ fields: { ...fields, fileUrl } });

  return { n8nResult, fileUrl };
};
