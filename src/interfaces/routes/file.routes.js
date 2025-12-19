import express from 'express';
import multer from 'multer';
import { uploadFile } from '../controllers/file.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/upload', upload.single('file'), uploadFile);

export default router;