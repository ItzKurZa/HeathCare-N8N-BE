import express from 'express';
import voiceCallController from '../controllers/voicecall.controller.js';

const router = express.Router();

/**
 * POST /api/voice-calls/initiate
 * Khởi tạo cuộc gọi voice với thông tin từ frontend
 */
router.post('/initiate', voiceCallController.initiateCallFromFrontend.bind(voiceCallController));

/**
 * POST /api/voice-calls/initiate/:appointmentId
 * Khởi tạo cuộc gọi voice cho appointment (manual trigger)
 */
router.post('/initiate/:appointmentId', voiceCallController.initiateCall.bind(voiceCallController));

/**
 * POST /api/voice-calls/webhook
 * Webhook nhận kết quả cuộc gọi từ ElevenLabs
 */
router.post('/webhook', voiceCallController.handleWebhook.bind(voiceCallController));

/**
 * GET /api/voice-calls/by-conversation/:conversationId
 * Lấy patient info theo ElevenLabs conversation_id
 */
router.get('/by-conversation/:conversationId', voiceCallController.getPatientInfoByConversation.bind(voiceCallController));

/**
 * GET /api/voice-calls/:voiceCallId/status
 * Lấy trạng thái cuộc gọi
 */
router.get('/:voiceCallId/status', voiceCallController.getCallStatus.bind(voiceCallController));

/**
 * GET /api/voice-calls
 * Lấy danh sách tất cả cuộc gọi
 */
router.get('/', voiceCallController.getAllCalls.bind(voiceCallController));

/**
 * GET /api/voice-calls/:voiceCallId/transcript
 * Lấy transcript của cuộc gọi
 */
router.get('/:voiceCallId/transcript', voiceCallController.getTranscript.bind(voiceCallController));

export default router;


