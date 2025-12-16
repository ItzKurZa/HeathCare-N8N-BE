import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to assets folder (relative to src folder)
const assetsPath = path.join(__dirname, '../../../assets');

// Serve logo image
router.get('/logo', (req, res) => {
  try {
    const logoPath = path.join(assetsPath, 'logo.jpg');
    
    // Check if logo exists
    if (!fs.existsSync(logoPath)) {
      return res.status(404).json({
        success: false,
        message: 'Logo not found',
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for email clients
    
    // Send file
    res.sendFile(logoPath);
  } catch (error) {
    console.error('Error serving logo:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving logo',
    });
  }
});

// Serve any asset file (optional - for flexibility)
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(assetsPath, filename);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(assetsPath)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Get file extension to set content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving asset:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving asset',
    });
  }
});

export default router;
