import { uploadMedicalFile } from '../../usecases/medfile/uploadMedicalFile.js';

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = req.user?.uid || req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User identity not found' });
    }

    const result = await uploadMedicalFile(userId, req.file);

    res.status(200).json({
      success: true,
      message: 'File uploaded and saved successfully',
      data: result
    });

  } catch (err) {
    next(err);
  }
};

export const deleteFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.uid;

    await deleteMedicalFileUsecase(userId, fileId);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};