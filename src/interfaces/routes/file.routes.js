import express from 'express';
import multer from 'multer';
import { uploadMedical } from '../controllers/file.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', upload.single('file'), uploadMedical);

export default router;