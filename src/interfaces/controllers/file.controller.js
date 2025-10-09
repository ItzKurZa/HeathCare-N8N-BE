import { sendMedicalFileToN8n } from '../../usecases/medical/sendMedicalFileToN8N.js';

export const uploadMedical = async (req, res, next) => {
    try {
        const file = req.file;
        const fields = req.body;
        const result = await sendMedicalFileToN8n({ fields, file });
        res.status(200).json({ success: true, result });
    } catch (err) {
        next(err);
    }
};