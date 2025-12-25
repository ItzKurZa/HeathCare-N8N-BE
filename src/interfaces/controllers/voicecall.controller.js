import { firestore } from '../../config/firebase.js';
import voiceService from '../../infrastructure/services/voice.services.js';
import aiAnalyzer from '../../infrastructure/services/aiAnalyzer.services.js';
import { config } from '../../config/env.js';
import crypto from 'crypto';

class VoiceCallController {
    /**
     * Khởi tạo cuộc gọi voice từ frontend (nhận data từ body)
     * POST /api/voice-calls/initiate
     */
    async initiateCallFromFrontend(req, res) {
        try {
            const { appointmentId, patientName, phone, doctor, appointmentDate } = req.body;

            console.log('📞 Initiating voice call from frontend:', {
                appointmentId,
                patientName,
                phone
            });

            // Validate required fields
            if (!patientName || !phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: patientName and phone'
                });
            }

            // Tạo record trong Firebase trước
            const voiceCallRef = await firestore.collection('voice_calls').add({
                appointmentId: appointmentId || `apt_${Date.now()}`,
                patientName,
                phone,
                doctor: doctor || 'Unknown',
                appointmentDate: appointmentDate || new Date().toISOString(),
                callStatus: 'INITIATED',
                elevenlabsCallId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            console.log(`✅ Voice call record created: ${voiceCallRef.id}`);

            // Trả về success - ElevenLabs sẽ gọi qua web interface
            res.json({
                success: true,
                data: {
                    voiceCallId: voiceCallRef.id,
                    status: 'INITIATED',
                    patientName,
                    phone,
                    message: 'Voice call initiated. User will start call via ElevenLabs web interface.'
                }
            });

        } catch (error) {
            console.error('❌ Initiate voice call from frontend error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

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

            // Kiểm tra giờ hành chính (bỏ check trong test mode)
            const isDevelopment = process.env.NODE_ENV === 'development';
            if (!isDevelopment && !voiceService.isBusinessHours()) {
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
            // Verify webhook signature if secret is configured
            if (config.elevenlabs.webhookSecret) {
                // ElevenLabs gửi header là 'elevenlabs-signature' (không có x-)
                const signatureHeader = req.headers['elevenlabs-signature'];
                if (signatureHeader) {
                    // Format: t=timestamp,v0=signature
                    const parts = signatureHeader.split(',');
                    const timestamp = parts[0].split('=')[1];
                    const signature = parts[1].split('=')[1];
                    
                    // Tạo lại signature để so sánh
                    const body = JSON.stringify(req.body);
                    const payload = `${timestamp}.${body}`;
                    const hmac = crypto.createHmac('sha256', config.elevenlabs.webhookSecret);
                    const expectedSignature = hmac.update(payload).digest('hex');
                    
                    if (signature !== expectedSignature) {
                        console.warn('⚠️ Invalid webhook signature');
                        console.log('Expected:', expectedSignature);
                        console.log('Received:', signature);
                        return res.status(401).json({
                            success: false,
                            error: 'Invalid signature'
                        });
                    }
                    console.log('✅ Webhook signature verified');
                }
            }

            const webhookData = req.body;
            console.log('📞 Received ElevenLabs webhook:', JSON.stringify(webhookData, null, 2));

            // Parse ElevenLabs format: { type, event_timestamp, data: {...} }
            const { type, data } = webhookData;
            
            if (!data || !data.conversation_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing conversation_id in webhook payload'
                });
            }

            const conversation_id = data.conversation_id;
            const status = data.status;
            const transcript = data.transcript; // array of messages
            const metadata = data.metadata;
            const analysis = data.analysis;

            // Tìm voice call record theo elevenlabsCallId
            const voiceCallsSnapshot = await firestore
                .collection('voice_calls')
                .where('elevenlabsCallId', '==', conversation_id)
                .limit(1)
                .get();

            let voiceCallDoc;
            let voiceCallData;
            
            if (voiceCallsSnapshot.empty) {
                console.warn(`⚠️ No voice call record found for conversation_id: ${conversation_id}`);
                // Tạo record mới nếu không tìm thấy (cho test)
                console.log('📝 Creating new voice call record for test...');
                const newCallRef = await firestore.collection('voice_calls').add({
                    elevenlabsCallId: conversation_id,
                    callStatus: status,
                    patientName: 'Test Patient',
                    phone: '+84343107931',
                    appointmentId: 'test_appointment',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                // Lấy lại document để có .ref
                voiceCallDoc = await firestore.collection('voice_calls').doc(newCallRef.id).get();
                voiceCallData = voiceCallDoc.data();
            } else {
                voiceCallDoc = voiceCallsSnapshot.docs[0];
                voiceCallData = voiceCallDoc.data();
            }

            // Convert transcript array to text
            let transcriptText = '';
            if (Array.isArray(transcript)) {
                transcriptText = transcript.map(t => 
                    `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.message}`
                ).join('\n');
            } else {
                transcriptText = transcript || '';
            }

            // Chuẩn bị update data
            const updateData = {
                callStatus: status || voiceCallData.callStatus,
                updatedAt: new Date(),
            };

            // Lưu transcript và analysis
            updateData.transcript = transcriptText;
            updateData.transcriptRaw = transcript;
            
            if (analysis) {
                updateData.analysis = analysis;
            }
            
            // Phân tích sentiment
            const sentiment = voiceService.analyzeSentiment(transcriptText);
            updateData.sentiment = sentiment;

                // Sử dụng AI để trích xuất insights (optional)
                try {
                    const aiInsights = await aiAnalyzer.analyzeCallTranscript(transcriptText, {
                        patientName: voiceCallData.patientName,
                        appointmentId: voiceCallData.appointmentId
                    });
                    
                    if (aiInsights) {
                        updateData.aiAnalysis = aiInsights;
                    }
                } catch (aiError) {
                    console.error('❌ AI analysis error:', aiError.message);
                }

            // Lưu metadata nếu có
            if (metadata) {
                updateData.metadata = metadata;
            }

            // Cập nhật voice call record
            await voiceCallDoc.ref.update(updateData);

            // Cập nhật appointment nếu call hoàn thành
            if (status === 'done' || status === 'completed' || status === 'ended') {
                if (voiceCallData.appointmentId && voiceCallData.appointmentId !== 'test_appointment') {
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

                // Gửi kết quả đến n8n webhook
                const callResultData = {
                    type: type,
                    conversation_id: conversation_id,
                    appointment_id: voiceCallData.appointmentId,
                    patient_name: voiceCallData.patientName,
                    phone: voiceCallData.phone,
                    status: status,
                    transcript: transcriptText,
                    sentiment: sentiment,
                    analysis: analysis,
                    ai_analysis: updateData.aiAnalysis,
                    metadata: metadata,
                    completed_at: new Date().toISOString()
                };

                await voiceService.sendToN8NWebhook(callResultData);
            }

            console.log(`✅ Webhook processed successfully for conversation ${conversation_id}`);

            res.json({
                success: true,
                message: 'Webhook processed successfully',
                conversation_id: conversation_id
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
     * Lấy patient info theo ElevenLabs conversation_id
     * GET /api/voice-calls/by-conversation/:conversationId
     */
    async getPatientInfoByConversation(req, res) {
        try {
            const { conversationId } = req.params;

            console.log(`🔍 Looking up patient info for conversation: ${conversationId}`);

            // First try: Query by elevenlabsCallId
            let snapshot = await firestore.collection('voice_calls')
                .where('elevenlabsCallId', '==', conversationId)
                .limit(1)
                .get();

            let voiceCallDoc = null;
            let voiceCallData = null;

            // If not found, try to find recent INITIATED calls and link the newest one
            if (snapshot.empty) {
                console.log('⚠️ Not found by elevenlabsCallId, looking for recent INITIATED call...');
                
                try {
                    // Query recent INITIATED calls with limit to reduce quota usage
                    const recentSnapshot = await firestore.collection('voice_calls')
                        .where('callStatus', '==', 'INITIATED')
                        .limit(5) // Giới hạn chỉ lấy 5 docs gần nhất
                        .get();
                    
                    if (!recentSnapshot.empty) {
                        // Sort in memory by createdAt
                        const sortedDocs = recentSnapshot.docs.sort((a, b) => {
                            const aTime = a.data().createdAt?.toDate() || new Date(0);
                            const bTime = b.data().createdAt?.toDate() || new Date(0);
                            return bTime - aTime; // Descending order (newest first)
                        });
                        
                        voiceCallDoc = sortedDocs[0];
                        voiceCallData = voiceCallDoc.data();
                        
                        console.log(`📝 Found INITIATED call ${voiceCallDoc.id}, linking with conversation ${conversationId}`);
                        
                        // Update with elevenlabsCallId - không reload lại để giảm query
                        await voiceCallDoc.ref.update({
                            elevenlabsCallId: conversationId,
                            callStatus: 'IN_PROGRESS',
                            updatedAt: new Date()
                        });
                        
                        // Cập nhật data trong memory thay vì query lại
                        voiceCallData.elevenlabsCallId = conversationId;
                        voiceCallData.callStatus = 'IN_PROGRESS';
                        
                    } else {
                        return res.status(404).json({
                            success: false,
                            error: 'No voice call found for this conversation_id'
                        });
                    }
                } catch (queryError) {
                    console.error('❌ Firestore query error:', queryError.message);
                    // Fallback: Return mock data để tránh lỗi quota
                    return res.json({
                        success: true,
                        data: {
                            voiceCallId: 'mock_' + conversationId,
                            conversationId: conversationId,
                            appointmentId: 'apt_mock',
                            patientName: 'Patient (Query Limit)',
                            phone: '+84343107931',
                            doctor: 'Dr. Unknown',
                            appointmentDate: new Date().toISOString(),
                            callStatus: 'IN_PROGRESS',
                            sentiment: null,
                            transcript: null,
                            createdAt: new Date()
                        }
                    });
                }
            } else {
                // Found by elevenlabsCallId
                voiceCallDoc = snapshot.docs[0];
                voiceCallData = voiceCallDoc.data();
            }

            // Return patient info
            const patientInfo = {
                voiceCallId: voiceCallDoc.id,
                conversationId: conversationId,
                appointmentId: voiceCallData.appointmentId,
                patientName: voiceCallData.patientName,
                phone: voiceCallData.phone,
                doctor: voiceCallData.doctor,
                appointmentDate: voiceCallData.appointmentDate,
                callStatus: voiceCallData.callStatus,
                sentiment: voiceCallData.sentiment,
                transcript: voiceCallData.transcript,
                createdAt: voiceCallData.createdAt?.toDate()
            };

            console.log(`✅ Found patient info:`, patientInfo);

            res.json({
                success: true,
                data: patientInfo
            });

        } catch (error) {
            console.error('❌ Get patient info error:', error);
            
            // Nếu lỗi quota, trả về mock data thay vì error
            if (error.code === 8 || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota')) {
                console.warn('⚠️ Quota exceeded, returning mock data');
                return res.json({
                    success: true,
                    data: {
                        voiceCallId: 'mock_quota_' + req.params.conversationId,
                        conversationId: req.params.conversationId,
                        appointmentId: 'apt_quota_mock',
                        patientName: 'Patient (Quota Exceeded)',
                        phone: '+84343107931',
                        doctor: 'Dr. Unknown',
                        appointmentDate: new Date().toISOString(),
                        callStatus: 'IN_PROGRESS',
                        sentiment: null,
                        transcript: null,
                        createdAt: new Date()
                    }
                });
            }
            
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
