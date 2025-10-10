import { sendMedicalFileToN8nAndCloud } from '../../usecases/medfile/uploadMedicalFile.js';

export const uploadMedical = async (req, res, next) => {
    try {
        const file = req.file;
        const fields = req.body;
        const result = await sendMedicalFileToN8nAndCloud({ fields, file });
        res.status(200).json({ file: result });
    } catch (err) {
        next(err);
    }
};