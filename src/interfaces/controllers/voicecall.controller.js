import { firestore } from '../../config/firebase.js';
import voiceService from '../../infrastructure/services/voice.services.js';
import aiAnalyzer from '../../infrastructure/services/aiAnalyzer.services.js';

class VoiceCallController {
    /**
     * Khởi tạo cuộc gọi voice cho appointment
     * POST /api/voice-calls/initiate/:appointmentId
     */
    async initiateCall(req, res) {
        try {
            const { appointmentId } = req.params;

            // Lấy thông tin appointment từ Firestore
            const appointmentDoc = await firestore.collection('appointments').doc(appointmentId).get();

            if (!appointmentDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            const appointment = {
                id: appointmentDoc.id,
                ...appointmentDoc.data()
            };

            // Validate phone number
            if (!appointment.phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number not found in appointment'
                });
            }

            // Kiểm tra đã gọi chưa
            if (appointment.voice_call_attempted && appointment.voice_call_status === 'SUCCESS') {
                return res.status(400).json({
                    success: false,
                    error: 'Voice call already completed for this appointment'
                });
            }

            // Kiểm tra giờ hành chính
            if (!voiceService.isBusinessHours()) {
                const nextTime = voiceService.getNextAvailableCallTime();
                return res.status(400).json({
                    success: false,
                    error: 'Outside business hours',
                    nextAvailableTime: nextTime
                });
            }

            // Thực hiện cuộc gọi
            const result = await voiceService.makeFollowUpCall(appointment);

            // Lưu thông tin cuộc gọi vào Firestore
            const voiceCallRef = await firestore.collection('voice_calls').add({
                appointmentId,
                patientName: appointment.fullName,
                phone: appointment.phone,
                callStatus: result.status,
                elevenlabsCallId: result.callId || null,
                error: result.error || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Cập nhật appointment
            await appointmentDoc.ref.update({
                voice_call_attempted: true,
                voice_call_status: result.status,
                voice_call_id: voiceCallRef.id,
                updatedAt: new Date(),
            });

            res.json({
                success: result.success,
                data: {
                    voiceCallId: voiceCallRef.id,
                    callId: result.callId,
                    status: result.status,
                    phoneNumber: result.phoneNumber
                }
            });

        } catch (error) {
            console.error('❌ Initiate voice call error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Webhook nhận kết quả cuộc gọi từ ElevenLabs
     * POST /api/voice-calls/webhook
     */
    async handleWebhook(req, res) {
        try {
            const webhookData = req.body;
            console.log('📞 Received ElevenLabs webhook:', JSON.stringify(webhookData, null, 2));

            const { call_id, status, transcript, metadata } = webhookData;

            if (!call_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing call_id in webhook payload'
                });
            }

            // Tìm voice call record theo elevenlabsCallId
            const voiceCallsSnapshot = await firestore
                .collection('voice_calls')
                .where('elevenlabsCallId', '==', call_id)
                .limit(1)
                .get();

            if (voiceCallsSnapshot.empty) {
                console.warn(`⚠️ No voice call record found for call_id: ${call_id}`);
                return res.status(404).json({
                    success: false,
                    error: 'Voice call record not found'
                });
            }

            const voiceCallDoc = voiceCallsSnapshot.docs[0];
            const voiceCallData = voiceCallDoc.data();

            // Chuẩn bị update data
            const updateData = {
                callStatus: status || voiceCallData.callStatus,
                updatedAt: new Date(),
            };

            // Lưu transcript nếu có
            if (transcript) {
                updateData.transcript = transcript;
                
                // Phân tích sentiment
                const sentiment = voiceService.analyzeSentiment(transcript);
                updateData.sentiment = sentiment;

                // Sử dụng AI để trích xuất insights
                try {
                    const aiInsights = await aiAnalyzer.analyzeCallTranscript(transcript, {
                        patientName: voiceCallData.patientName,
                        appointmentId: voiceCallData.appointmentId
                    });
                    
                    if (aiInsights) {
                        updateData.aiAnalysis = aiInsights;
                    }
                } catch (aiError) {
                    console.error('❌ AI analysis error:', aiError.message);
                }
            }

            // Lưu metadata nếu có
            if (metadata) {
                updateData.metadata = metadata;
            }

            // Cập nhật voice call record
            await voiceCallDoc.ref.update(updateData);

            // Cập nhật appointment nếu call hoàn thành
            if (status === 'completed' || status === 'ended') {
                const appointmentDoc = await firestore
                    .collection('appointments')
                    .doc(voiceCallData.appointmentId)
                    .get();

                if (appointmentDoc.exists) {
                    await appointmentDoc.ref.update({
                        voice_call_status: 'SUCCESS',
                        voice_call_completed_at: new Date(),
                        updatedAt: new Date(),
                    });
                }
            }

            console.log(`✅ Webhook processed successfully for call ${call_id}`);

            res.json({
                success: true,
                message: 'Webhook processed successfully'
            });

        } catch (error) {
            console.error('❌ Webhook processing error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lấy trạng thái cuộc gọi
     * GET /api/voice-calls/:voiceCallId/status
     */
    async getCallStatus(req, res) {
        try {
            const { voiceCallId } = req.params;

            const voiceCallDoc = await firestore.collection('voice_calls').doc(voiceCallId).get();

            if (!voiceCallDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Voice call not found'
                });
            }

            const voiceCallData = voiceCallDoc.data();

            // Nếu có elevenlabsCallId, lấy status mới nhất từ ElevenLabs
            if (voiceCallData.elevenlabsCallId) {
                const latestStatus = await voiceService.getCallStatus(voiceCallData.elevenlabsCallId);
                
                if (latestStatus && latestStatus.status !== voiceCallData.callStatus) {
                    // Cập nhật status mới
                    await voiceCallDoc.ref.update({
                        callStatus: latestStatus.status,
                        updatedAt: new Date(),
                    });

                    voiceCallData.callStatus = latestStatus.status;
                }
            }

            res.json({
                success: true,
                data: {
                    id: voiceCallDoc.id,
                    ...voiceCallData,
                    createdAt: voiceCallData.createdAt?.toDate(),
                    updatedAt: voiceCallData.updatedAt?.toDate(),
                }
            });

        } catch (error) {
            console.error('❌ Get call status error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lấy danh sách tất cả cuộc gọi
     * GET /api/voice-calls
     */
    async getAllCalls(req, res) {
        try {
            const { status, limit = 50 } = req.query;

            let query = firestore.collection('voice_calls')
                .orderBy('createdAt', 'desc')
                .limit(parseInt(limit));

            if (status) {
                query = query.where('callStatus', '==', status);
            }

            const snapshot = await query.get();

            const calls = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate(),
                updatedAt: doc.data().updatedAt?.toDate(),
            }));

            res.json({
                success: true,
                data: calls,
                count: calls.length
            });

        } catch (error) {
            console.error('❌ Get all calls error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lấy transcript của cuộc gọi
     * GET /api/voice-calls/:voiceCallId/transcript
     */
    async getTranscript(req, res) {
        try {
            const { voiceCallId } = req.params;

            const voiceCallDoc = await firestore.collection('voice_calls').doc(voiceCallId).get();

            if (!voiceCallDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Voice call not found'
                });
            }

            const voiceCallData = voiceCallDoc.data();

            // Nếu chưa có transcript trong DB, lấy từ ElevenLabs
            if (!voiceCallData.transcript && voiceCallData.elevenlabsCallId) {
                const transcript = await voiceService.getCallTranscript(voiceCallData.elevenlabsCallId);
                
                if (transcript) {
                    // Lưu transcript vào DB
                    await voiceCallDoc.ref.update({
                        transcript: transcript,
                        updatedAt: new Date(),
                    });

                    return res.json({
                        success: true,
                        data: {
                            transcript: transcript,
                            voiceCallId: voiceCallId
                        }
                    });
                }
            }

            res.json({
                success: true,
                data: {
                    transcript: voiceCallData.transcript || null,
                    sentiment: voiceCallData.sentiment || null,
                    aiAnalysis: voiceCallData.aiAnalysis || null,
                    voiceCallId: voiceCallId
                }
            });

        } catch (error) {
            console.error('❌ Get transcript error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default new VoiceCallController();
