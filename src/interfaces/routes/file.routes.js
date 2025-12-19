import express from 'express';
import multer from 'multer';
import { uploadFile, deleteFile, getMedicalFilesList } from '../controllers/file.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/upload', requireAuth, upload.single('file'), uploadFile);
router.delete('/:fileId', requireAuth, deleteFile);
router.get('/upload-files', requireAuth, getMedicalFilesList);

export default router;