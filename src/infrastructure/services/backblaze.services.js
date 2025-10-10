// infrastructure/services/backblaze.services.js
import { backblaze, backblazeInitialized } from '../../config/backblaze.js';
import { config } from '../../config/env.js';

export const uploadFileToBackblaze = async (file) => {
    if (!file) throw new Error('File required');
    if (!backblazeInitialized || !backblaze) {
        throw new Error('Backblaze not initialized');
    }

    try {
        await backblaze.authorize();

        const uploadUrlResponse = await backblaze.getUploadUrl({
            bucketId: config.backblaze.bucketId,
        });

        const { uploadUrl, authorizationToken } = uploadUrlResponse.data;

        const uploadResponse = await backblaze.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName: file.originalname,
            data: file.buffer,
        });

        const { fileName } = uploadResponse.data;

        let fileUrl;

        if (config.backblaze.isPrivateBucket === 'true') {
            const validDuration = Number(config.backblaze.tempUrlDuration); // default: 1h

            const authResponse = await backblaze.getDownloadAuthorization({
                bucketId: config.backblaze.bucketId,
                fileNamePrefix: fileName,
                validDurationInSeconds: validDuration,
            });

            const token = authResponse.data.authorizationToken;
            fileUrl = `${config.backblaze.downloadBaseUrl}/file/${config.backblaze.bucketName}/${encodeURIComponent(fileName)}?Authorization=${token}`;
        } else {
            // Public bucket
            fileUrl = `${config.backblaze.downloadBaseUrl}/file/${config.backblaze.bucketName}/${encodeURIComponent(fileName)}`;
        }

        console.log(`✅ Uploaded ${fileName} to Backblaze → ${fileUrl}`);

        return { fileId: uploadResponse.data.fileId, fileUrl };
    } catch (err) {
        console.error('❌ Backblaze upload failed:', err.message);
        throw err;
    }
};
