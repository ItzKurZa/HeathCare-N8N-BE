import express from 'express';
import { firestore } from '../../config/firebase.js';
import aiAnalyzer from '../../infrastructure/services/aiAnalyzer.services.js';
import emailService from '../../infrastructure/services/email.services.js';
import { 
    handleVoiceSurveyWebhook, 
    initiateVoiceSurvey,
    getVoiceSurveyStatus 
} from '../controllers/survey.controller.js';

const router = express.Router();

/**
 * POST /api/surveys/submit
 * Webhook nhận survey response từ form
 */
router.post('/submit', async (req, res) => {
    try {
        const {
            booking_id,
            patient_name,
            phone,
            email,
            nps,
            csat,
            facility,
            staff_attitude,
            waiting_time,
            comment
        } = req.body;

        // Validate required fields
        if (!booking_id || !patient_name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: booking_id, patient_name, phone'
            });
        }

        // Chuẩn bị dữ liệu survey
        const surveyData = {
            appointmentId: booking_id,
            patientName: patient_name,
            phone,
            email: email || null,
            nps: parseInt(nps) || 0,
            csat: parseInt(csat) || 0,
            facility: parseInt(facility) || 0,
            staff_doctor: staff_attitude?.doctor_label || null,
            staff_reception: staff_attitude?.reception_label || null,
            staff_nurse: staff_attitude?.nurse_label || null,
            waiting_time: waiting_time || null,
            comment: comment || null,
            submittedAt: new Date(),
        };

        // Tính điểm trung bình (0-10 scale)
        const npsScore = surveyData.nps; // already 0-10
        const csatScore = surveyData.csat * 2; // 0-5 -> 0-10
        const facilityScore = surveyData.facility * 2; // 0-5 -> 0-10
        const scores = [npsScore, csatScore, facilityScore].filter(s => s > 0);
        surveyData.overall_score = scores.length > 0 
            ? scores.reduce((a, b) => a + b) / scores.length 
            : 0;

        // Xác định có cần cải thiện không
        surveyData.improvement_trigger = 
            surveyData.overall_score < 7 || 
            surveyData.nps < 7 ||
            (surveyData.comment && surveyData.comment.length > 0);

        // Lưu vào Firestore
        const surveyRef = await firestore.collection('surveys').add(surveyData);
        console.log(`✅ Survey saved with ID: ${surveyRef.id}`);

        // Cập nhật appointment status
        if (booking_id) {
            const appointmentQuery = await firestore.collection('appointments')
                .where('bookingId', '==', booking_id)
                .limit(1)
                .get();

            if (!appointmentQuery.empty) {
                const appointmentDoc = appointmentQuery.docs[0];
                await appointmentDoc.ref.update({
                    survey_completed: true,
                    survey_completed_at: new Date(),
                    survey_score: surveyData.overall_score,
                    updatedAt: new Date(),
                });
                console.log(`✅ Appointment ${appointmentDoc.id} updated with survey completion`);
            }
        }

        // Nếu cần cải thiện -> Phân tích AI + Gửi alert
        if (surveyData.improvement_trigger) {
            console.log(`⚠️ Improvement needed for ${patient_name}, triggering AI analysis...`);

            // Chạy AI analysis (async, không block response)
            aiAnalyzer.analyze(surveyData)
                .then(async (analysis) => {
                    // Gửi email alert cho CSKH
                    await emailService.sendAlert(surveyData, analysis);

                    // Lưu alert vào Firestore
                    await firestore.collection('alerts').add({
                        surveyId: surveyRef.id,
                        appointmentId: booking_id,
                        patientName: patient_name,
                        phone,
                        overallScore: surveyData.overall_score,
                        analysis,
                        status: 'PENDING', // PENDING, IN_PROGRESS, RESOLVED
                        createdAt: new Date(),
                    });

                    console.log(`✅ Alert created and email sent for survey ${surveyRef.id}`);
                })
                .catch(err => {
                    console.error('❌ Error processing improvement trigger:', err);
                });
        }

        // Response format cho n8n workflow
        res.status(201).json({
            success: true,
            message: 'Survey submitted successfully',
            data: {
                surveyId: surveyRef.id,
                overall_score: surveyData.overall_score,
                needsImprovement: surveyData.improvement_trigger, // ← Key field cho n8n IF node
                data: {
                    appointmentId: booking_id,
                    patientName: patient_name,
                    phone,
                    email,
                    overall_score: surveyData.overall_score,
                    nps: surveyData.nps,
                    csat: surveyData.csat,
                    facility: surveyData.facility,
                    comment: surveyData.comment
                }
            }
        });

    } catch (error) {
        console.error('❌ Survey submission error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/surveys/:appointmentId
 * Lấy survey theo appointment ID
 */
router.get('/:appointmentId', async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const surveysSnapshot = await firestore.collection('surveys')
            .where('appointmentId', '==', appointmentId)
            .orderBy('submittedAt', 'desc')
            .limit(1)
            .get();

        if (surveysSnapshot.empty) {
            return res.status(404).json({
                success: false,
                error: 'Survey not found'
            });
        }

        const survey = surveysSnapshot.docs[0];
        res.json({
            success: true,
            data: {
                id: survey.id,
                ...survey.data()
            }
        });

    } catch (error) {
        console.error('❌ Get survey error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/surveys
 * Lấy danh sách surveys với filter
 */
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        
        let query = firestore.collection('surveys')
            .orderBy('submittedAt', 'desc');

        if (status === 'need_improvement') {
            query = query.where('improvement_trigger', '==', true);
        }

        const limitNum = parseInt(limit);
        const pageNum = parseInt(page);
        const offset = (pageNum - 1) * limitNum;

        const snapshot = await query.limit(limitNum).offset(offset).get();
        
        const surveys = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            data: surveys,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: surveys.length
            }
        });

    } catch (error) {
        console.error('❌ Get surveys error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/surveys/stats/summary
 * Thống kê tổng quan surveys
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const surveysSnapshot = await firestore.collection('surveys').get();
        
        let totalSurveys = 0;
        let totalNPS = 0;
        let totalCSAT = 0;
        let totalFacility = 0;
        let needImprovement = 0;

        surveysSnapshot.forEach(doc => {
            const data = doc.data();
            totalSurveys++;
            totalNPS += data.nps || 0;
            totalCSAT += data.csat || 0;
            totalFacility += data.facility || 0;
            if (data.improvement_trigger) needImprovement++;
        });

        res.json({
            success: true,
            data: {
                totalSurveys,
                averageNPS: totalSurveys > 0 ? (totalNPS / totalSurveys).toFixed(2) : 0,
                averageCSAT: totalSurveys > 0 ? (totalCSAT / totalSurveys).toFixed(2) : 0,
                averageFacility: totalSurveys > 0 ? (totalFacility / totalSurveys).toFixed(2) : 0,
                needImprovement,
                improvementRate: totalSurveys > 0 ? ((needImprovement / totalSurveys) * 100).toFixed(1) + '%' : '0%'
            }
        });

    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Voice Survey Routes
 */

// POST /api/surveys/voice-webhook
// Webhook from ElevenLabs after voice survey call completes
router.post('/voice-webhook', handleVoiceSurveyWebhook);

// POST /api/surveys/voice-initiate
// Initiate a voice survey call
router.post('/voice-initiate', initiateVoiceSurvey);

// GET /api/surveys/voice-status/:callId
// Get voice survey call status
router.get('/voice-status/:callId', getVoiceSurveyStatus);

export default router;
