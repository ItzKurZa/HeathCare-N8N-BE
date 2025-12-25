import { firestore } from '../../config/firebase.js';
import aiAnalyzer from '../../infrastructure/services/aiAnalyzer.services.js';
import emailService from '../../infrastructure/services/email.services.js';

/**
 * Handle webhook from ElevenLabs after voice survey call completes
 * POST /api/surveys/voice-webhook
 */
export const handleVoiceSurveyWebhook = async (req, res) => {
    try {
        console.log('📞 Voice survey webhook received:', req.body);

        const {
            call_id,
            status,
            transcript,
            extracted_data,
            duration,
            phone_number
        } = req.body;

        // Validate webhook data
        if (!call_id || !status) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: call_id, status'
            });
        }

        // Only process completed calls
        if (status !== 'completed' && status !== 'ended') {
            console.log(`⏸️ Call ${call_id} status: ${status} - skipping processing`);
            return res.status(200).json({
                success: true,
                message: 'Call not completed yet'
            });
        }

        // Extract survey data from AI agent's extracted_data
        const surveyData = extracted_data || {};

        // Validate essential fields
        if (!surveyData.booking_id || !surveyData.patient_name) {
            console.error('❌ Missing essential survey data:', surveyData);
            return res.status(400).json({
                success: false,
                error: 'Incomplete survey data from voice call'
            });
        }

        // Prepare survey document for Firestore
        const surveyDocument = {
            // Basic info
            appointmentId: surveyData.booking_id,
            patientName: surveyData.patient_name,
            phone: surveyData.phone || phone_number,
            email: surveyData.email || null,

            // Scores
            nps: parseInt(surveyData.nps) || 0,
            csat: parseInt(surveyData.csat) || 0,
            facility: parseInt(surveyData.facility) || 0,

            // Staff attitude
            staff_doctor: surveyData.staff_attitude?.doctor_label || null,
            staff_reception: surveyData.staff_attitude?.reception_label || null,
            staff_nurse: surveyData.staff_attitude?.nurse_label || null,

            // Additional info
            waiting_time: surveyData.waiting_time || null,
            comment: surveyData.comment || null,

            // Voice call metadata
            source: 'voice_call',
            call_id: call_id,
            call_duration: duration || null,
            transcript: transcript || null,

            // Timestamps
            submittedAt: new Date(),
        };

        // Calculate overall score (0-10 scale)
        const npsScore = surveyDocument.nps; // already 0-10
        const csatScore = surveyDocument.csat * 2; // 0-5 -> 0-10
        const facilityScore = surveyDocument.facility * 2; // 0-5 -> 0-10
        const scores = [npsScore, csatScore, facilityScore].filter(s => s > 0);
        surveyDocument.overall_score = scores.length > 0 
            ? scores.reduce((a, b) => a + b) / scores.length 
            : 0;

        // Determine if improvement needed
        surveyDocument.improvement_trigger = 
            surveyDocument.overall_score < 7 || 
            surveyDocument.nps < 7 ||
            (surveyDocument.comment && surveyDocument.comment.length > 0);

        // Save to Firestore
        const surveyRef = await firestore.collection('surveys').add(surveyDocument);
        console.log(`✅ Voice survey saved with ID: ${surveyRef.id}`);

        // Update appointment status
        const appointmentQuery = await firestore.collection('appointments')
            .where('submissionId', '==', surveyData.booking_id)
            .limit(1)
            .get();

        if (!appointmentQuery.empty) {
            const appointmentDoc = appointmentQuery.docs[0];
            await appointmentDoc.ref.update({
                survey_completed: true,
                survey_method: 'voice_call',
                survey_completed_at: new Date(),
                survey_score: surveyDocument.overall_score,
                voice_call_id: call_id,
                updatedAt: new Date(),
            });
            console.log(`✅ Appointment ${appointmentDoc.id} updated with voice survey completion`);
        }

        // If improvement needed → AI analysis + Alert
        if (surveyDocument.improvement_trigger) {
            console.log(`⚠️ Low satisfaction score detected for ${surveyData.patient_name}`);

            // Run AI analysis (async, don't block webhook response)
            aiAnalyzer.analyze(surveyDocument)
                .then(async (analysis) => {
                    // Send email alert to customer service
                    await emailService.sendAlert(surveyDocument, analysis);

                    // Save alert to Firestore
                    await firestore.collection('alerts').add({
                        type: 'LOW_SATISFACTION',
                        severity: surveyDocument.overall_score < 5 ? 'HIGH' : 'MEDIUM',
                        appointmentId: surveyData.booking_id,
                        patientName: surveyData.patient_name,
                        score: surveyDocument.overall_score,
                        source: 'voice_survey',
                        analysis: analysis,
                        createdAt: new Date(),
                        resolved: false,
                    });

                    console.log(`📧 Alert sent for low satisfaction survey`);
                })
                .catch(error => {
                    console.error('❌ Error in AI analysis/alert:', error.message);
                });
        }

        // Return success response to ElevenLabs
        return res.status(200).json({
            success: true,
            message: 'Voice survey processed successfully',
            survey_id: surveyRef.id,
            overall_score: surveyDocument.overall_score,
        });

    } catch (error) {
        console.error('❌ Voice survey webhook error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};

/**
 * Initiate a voice survey call
 * POST /api/surveys/voice-initiate
 */
export const initiateVoiceSurvey = async (req, res) => {
    try {
        const { patientId, appointmentId, phone } = req.body;

        if (!patientId || !appointmentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: patientId, appointmentId'
            });
        }

        // Get appointment details
        const appointmentQuery = await firestore.collection('appointments')
            .where('submissionId', '==', appointmentId)
            .limit(1)
            .get();

        // If no appointment found, create demo data for testing
        let appointment;
        if (appointmentQuery.empty) {
            console.log('⚠️  Appointment not found, using demo data for testing');
            appointment = {
                id: appointmentId,
                bookingId: appointmentId,
                patientName: 'Bệnh nhân Demo',
                fullName: 'Bệnh nhân Demo',
                phone: phone || '+84912345678',
                doctorName: 'BS. Demo',
                doctor: 'BS. Demo',
                appointmentDate: new Date().toISOString(),
                startTimeLocal: new Date().toISOString(),
                survey_completed: false
            };
        } else {
            const appointmentDoc = appointmentQuery.docs[0];
            appointment = appointmentDoc.data();

            // Check if survey already completed
            if (appointment.survey_completed) {
                return res.status(400).json({
                    success: false,
                    error: 'Survey already completed for this appointment'
                });
            }
        }

        // Use voice service to initiate call
        const voiceService = (await import('../../infrastructure/services/voice.services.js')).default;
        
        const callResult = await voiceService.makeFollowUpCall({
            id: appointmentId,
            fullName: appointment.patientName || appointment.fullName,
            phone: phone || appointment.phone,
            doctor: appointment.doctorName || appointment.doctor,
            startTimeLocal: appointment.appointmentDate || appointment.startTimeLocal,
        });

        if (!callResult.success) {
            return res.status(500).json({
                success: false,
                error: callResult.error || 'Failed to initiate voice call'
            });
        }

        // Save call initiation to Firestore
        await firestore.collection('voice_surveys').add({
            appointmentId: appointmentId,
            patientId: patientId,
            callId: callResult.callId,
            status: 'INITIATED',
            phoneNumber: callResult.phoneNumber,
            initiatedAt: new Date(),
        });

        return res.status(200).json({
            success: true,
            message: 'Voice survey call initiated successfully',
            callId: callResult.callId,
            status: callResult.status,
        });

    } catch (error) {
        console.error('❌ Initiate voice survey error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};

/**
 * Get voice survey call status
 * GET /api/surveys/voice-status/:callId
 */
export const getVoiceSurveyStatus = async (req, res) => {
    try {
        const { callId } = req.params;

        if (!callId) {
            return res.status(400).json({
                success: false,
                error: 'Missing callId parameter'
            });
        }

        // Get from Firestore
        const voiceSurveyQuery = await firestore.collection('voice_surveys')
            .where('callId', '==', callId)
            .limit(1)
            .get();

        if (voiceSurveyQuery.empty) {
            return res.status(404).json({
                success: false,
                error: 'Voice survey call not found'
            });
        }

        const voiceSurvey = voiceSurveyQuery.docs[0].data();

        // Get call status from ElevenLabs
        const voiceService = (await import('../../infrastructure/services/voice.services.js')).default;
        const callStatus = await voiceService.getCallStatus(callId);

        return res.status(200).json({
            success: true,
            data: {
                callId: callId,
                status: callStatus?.status || voiceSurvey.status,
                appointmentId: voiceSurvey.appointmentId,
                initiatedAt: voiceSurvey.initiatedAt,
                completedAt: voiceSurvey.completedAt || null,
            }
        });

    } catch (error) {
        console.error('❌ Get voice survey status error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};

/**
 * Get Dashboard Statistics
 * GET /api/surveys/stats
 */
export const getDashboardStats = async (req, res) => {
    try {
        console.log('📊 Getting dashboard statistics...');

        // Get all surveys
        const surveysSnapshot = await firestore.collection('surveys')
            .orderBy('submittedAt', 'desc')
            .get();

        const surveys = surveysSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Get all alerts
        const alertsSnapshot = await firestore.collection('alerts')
            .orderBy('createdAt', 'desc')
            .get();

        const alerts = alertsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Get all voice calls
        const voiceCallsSnapshot = await firestore.collection('voice_calls')
            .orderBy('createdAt', 'desc')
            .get();

        const voiceCalls = voiceCallsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Calculate statistics
        const totalSurveys = surveys.length;
        const completedSurveys = surveys.filter(s => s.overall_score !== undefined).length;
        const averageScore = totalSurveys > 0 
            ? surveys.reduce((sum, s) => sum + (s.overall_score || 0), 0) / totalSurveys 
            : 0;

        const pendingAlerts = alerts.filter(a => !a.resolved).length;
        const resolvedAlerts = alerts.filter(a => a.resolved).length;

        const totalVoiceCalls = voiceCalls.length;
        const successVoiceCalls = voiceCalls.filter(c => 
            c.status === 'completed' || c.status === 'ended'
        ).length;

        // Negative surveys (score < 7)
        const negativeSurveys = surveys.filter(s => (s.overall_score || 0) < 7).length;

        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySurveys = surveys.filter(s => {
            const submittedAt = s.submittedAt?.toDate ? s.submittedAt.toDate() : new Date(s.submittedAt);
            return submittedAt >= today;
        }).length;

        const todayAlerts = alerts.filter(a => {
            const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            return createdAt >= today;
        }).length;

        return res.status(200).json({
            success: true,
            data: {
                surveys: {
                    total: totalSurveys,
                    completed: completedSurveys,
                    negative: negativeSurveys,
                    averageScore: parseFloat(averageScore.toFixed(2)),
                    today: todaySurveys
                },
                alerts: {
                    total: alerts.length,
                    pending: pendingAlerts,
                    resolved: resolvedAlerts,
                    today: todayAlerts
                },
                voiceCalls: {
                    total: totalVoiceCalls,
                    success: successVoiceCalls,
                    successRate: totalVoiceCalls > 0 
                        ? parseFloat((successVoiceCalls / totalVoiceCalls * 100).toFixed(1)) 
                        : 0
                }
            }
        });

    } catch (error) {
        console.error('❌ Get dashboard stats error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

/**
 * Get Recent Surveys
 * GET /api/surveys/recent
 */
export const getRecentSurveys = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const surveysSnapshot = await firestore.collection('surveys')
            .orderBy('submittedAt', 'desc')
            .limit(limit)
            .get();

        const surveys = surveysSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                patientName: data.patientName,
                appointmentId: data.appointmentId,
                nps: data.nps,
                csat: data.csat,
                overall_score: data.overall_score,
                source: data.source || 'form',
                comment: data.comment,
                submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt,
                improvement_trigger: data.improvement_trigger
            };
        });

        return res.status(200).json({
            success: true,
            data: surveys
        });

    } catch (error) {
        console.error('❌ Get recent surveys error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
