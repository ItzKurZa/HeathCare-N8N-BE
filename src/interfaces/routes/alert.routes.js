import express from 'express';
import emailService from '../../infrastructure/services/email.services.js';
import { firestore as db } from '../../config/firebase.js';

const router = express.Router();

/**
 * POST /api/alerts/send
 * Send alert email for low-rated survey
 */
router.post('/send', async (req, res, next) => {
  try {
    console.log('🚨 Alert send request body:', JSON.stringify(req.body, null, 2));
    
    // Extract data - support multiple nested formats from n8n
    const body = req.body.body || req.body;
    const rawSurveyData = body.surveyData || body;
    const aiAnalysis = body.aiAnalysis || body.analysis || '';
    
    // Survey data can be nested in .data
    const surveyData = rawSurveyData.data || rawSurveyData;

    if (!surveyData || !surveyData.patientName) {
      return res.status(400).json({
        success: false,
        error: 'Missing surveyData or patientName',
        received: { surveyData, rawSurveyData }
      });
    }

    // Parse userAnswers and numericScores from n8n voice workflow
    const userAnswers = surveyData.userAnswers || [];
    const numericScores = surveyData.numericScores || [];
    
    // Extract scores based on question order
    const npsScore = numericScores[0] || surveyData.nps || 0;
    const csatScore = numericScores[1] || surveyData.csat || 0;
    const facilityScore = numericScores[2] || surveyData.facility || 0;
    
    // Extract text answers (Tốt/Bình thường/Cần cải thiện)
    const staffDoctor = userAnswers[3] || surveyData.staff_doctor || null;
    const staffReception = userAnswers[4] || surveyData.staff_reception || null;
    const staffNurse = userAnswers[5] || surveyData.staff_nurse || null;
    const waitingTime = userAnswers[6] || surveyData.waiting_time || null;
    const comment = userAnswers[7] || surveyData.comment || '';
    
    // Calculate overall score from numeric scores
    const overall_score = numericScores.length > 0
      ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
      : (surveyData.overall_score || rawSurveyData.overall_score || 0);

    // Ensure required fields have defaults
    const normalizedSurveyData = {
      patientName: surveyData.patientName || 'Bệnh nhân',
      phone: surveyData.phone || 'N/A',
      appointmentId: surveyData.appointmentId || rawSurveyData.surveyId || 'N/A',
      nps: npsScore,
      csat: csatScore,
      facility: facilityScore,
      overall_score: overall_score,
      staff_doctor: staffDoctor,
      staff_reception: staffReception,
      staff_nurse: staffNurse,
      waiting_time: waitingTime,
      comment: comment,
      submittedAt: surveyData.submittedAt || new Date()
    };

    console.log('📧 Sending alert for:', normalizedSurveyData.patientName);

    // Send alert email
    const result = await emailService.sendAlert(normalizedSurveyData, aiAnalysis);

    // Save alert to database
    const alertDoc = await db.collection('alerts').add({
      type: 'SURVEY_LOW_RATING',
      appointmentId: normalizedSurveyData.appointmentId,
      surveyData: normalizedSurveyData,
      aiAnalysis,
      emailSent: result.success,
      emailId: result.messageId,
      createdAt: new Date(),
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'Alert sent successfully',
      data: { 
        alertId: alertDoc.id,
        emailSent: result.success,
        emailId: result.messageId
      }
    });
  } catch (error) {
    console.error('❌ Alert send error:', error);
    next(error);
  }
});

/**
 * POST /api/alerts/voice-alert
 * Send alert email for negative voice call
 */
router.post('/voice-alert', async (req, res, next) => {
  try {
    console.log('🚨 Voice alert received:', JSON.stringify(req.body, null, 2));
    
    // Support multiple formats from n8n
    const data = req.body.callData || req.body;
    
    // Extract transcript
    let transcriptText = '';
    if (data.transcript) {
      if (Array.isArray(data.transcript)) {
        transcriptText = data.transcript.map(t => 
          `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.message}`
        ).join('\n');
      } else {
        transcriptText = data.transcript;
      }
    }

    const cskhEmail = process.env.CSKH_EMAIL || 'cskh@healthcare.com';
    
    // Determine sentiment
    const sentiment = data.sentiment || data.evaluation?.sentiment || 'unknown';
    const isNegative = sentiment === 'negative' || data.evaluation?.isNegative;
    
    console.log('📧 Sending voice alert email to:', cskhEmail);
    console.log('- Sentiment:', sentiment, '(negative?', isNegative, ')');

    // Send voice call alert email
    const result = await emailService.sendAlert({
      to: cskhEmail,
      patientName: data.patientName || 'Khách hàng',
      appointmentId: data.appointmentId || data.conversationId || 'N/A',
      score: isNegative ? 1 : 5,
      feedback: transcriptText || 'Voice call completed',
      analysis: data.analysis?.transcript_summary || data.aiAnalysis || 'Negative feedback detected'
    });

    // Save alert to database
    const alertDoc = await db.collection('alerts').add({
      type: 'VOICE_CALL_NEGATIVE',
      conversationId: data.conversationId || data.conversation_id,
      agentId: data.agentId || data.agent_id,
      sentiment: sentiment,
      callData: data,
      emailSent: result.success,
      emailId: result.messageId,
      createdAt: new Date(),
      status: 'pending'
    });

    console.log('✅ Alert saved with ID:', alertDoc.id);

    res.json({
      success: true,
      message: 'Voice alert sent successfully',
      data: { 
        alertId: alertDoc.id,
        emailSent: result.success,
        emailId: result.messageId,
        sentiment: sentiment
      }
    });
  } catch (error) {
    console.error('❌ Voice alert error:', error);
    next(error);
  }
});

/**
 * GET /api/alerts
 * Get all alerts with filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const { type, status, limit = 50, startDate, endDate } = req.query;

    let query = db.collection('alerts').orderBy('createdAt', 'desc').limit(parseInt(limit));

    if (type) {
      query = query.where('type', '==', type);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }

    const snapshot = await query.get();
    const alerts = [];

    snapshot.forEach(doc => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });

    res.json({
      success: true,
      data: alerts,
      total: alerts.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/alerts/list
 * Get alerts list for Dashboard CSKH
 */
router.get('/list', async (req, res, next) => {
  try {
    const { limit = 20, resolved } = req.query;

    let query = db.collection('alerts').orderBy('createdAt', 'desc');

    // Filter by resolved status if specified
    if (resolved === 'true') {
      query = query.where('resolved', '==', true);
    } else if (resolved === 'false') {
      query = query.where('resolved', '==', false);
    }

    query = query.limit(parseInt(limit));

    const snapshot = await query.get();
    const alerts = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      alerts.push({
        id: doc.id,
        type: data.type,
        severity: data.severity || 'MEDIUM',
        patientName: data.patientName || data.surveyData?.patientName || data.callData?.patientName || 'N/A',
        appointmentId: data.appointmentId,
        score: data.score || data.surveyData?.overall_score,
        source: data.source || (data.type === 'VOICE_CALL_NEGATIVE' ? 'voice' : 'survey'),
        resolved: data.resolved || data.status === 'resolved',
        analysis: data.analysis || data.aiAnalysis,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      });
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/alerts/:id/resolve
 * Resolve an alert
 */
router.put('/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const docRef = db.collection('alerts').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    await docRef.update({
      resolved: true,
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedNotes: notes || null,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: { id, resolved: true }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/alerts/:id
 * Get specific alert by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await db.collection('alerts').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/alerts/:id/status
 * Update alert status (pending, in_progress, resolved)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: pending, in_progress, resolved, or dismissed'
      });
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    await db.collection('alerts').doc(id).update(updateData);

    res.json({
      success: true,
      message: 'Alert status updated',
      data: { id, status }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/alerts/stats/summary
 * Get alerts statistics
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = db.collection('alerts');

    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }

    const snapshot = await query.get();

    const stats = {
      total: 0,
      byType: {
        SURVEY_LOW_RATING: 0,
        VOICE_CALL_NEGATIVE: 0
      },
      byStatus: {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        dismissed: 0
      },
      emailSuccess: 0,
      emailFailed: 0
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      stats.total++;
      
      if (data.type) {
        stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
      }
      
      if (data.status) {
        stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
      }
      
      if (data.emailSent === true) {
        stats.emailSuccess++;
      } else if (data.emailSent === false) {
        stats.emailFailed++;
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert (soft delete by marking as dismissed)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.collection('alerts').doc(id).update({
      status: 'dismissed',
      deletedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Alert dismissed successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
