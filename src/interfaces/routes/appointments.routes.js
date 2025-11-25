import express from 'express';
import { firestore as db } from '../../config/firebase.js';

const router = express.Router();

/**
 * GET /api/appointments
 * Get appointments with filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = 100 } = req.query;

    let query = db.collection('appointments').orderBy('created_at', 'desc').limit(parseInt(limit));

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const appointments = [];

    snapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data(),
        startTimeLocal: doc.data().startTimeLocal?.toDate(),
        created_at: doc.data().created_at?.toDate(),
        updated_at: doc.data().updated_at?.toDate()
      });
    });

    res.json({
      success: true,
      data: appointments,
      total: appointments.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments/need-voice-call
 * Get appointments that need follow-up voice calls
 * Criteria: survey submitted with score < 7, not called yet
 */
router.get('/need-voice-call', async (req, res, next) => {
  try {
    // Get surveys with low scores
    const surveysSnapshot = await db.collection('surveys')
      .where('overall_score', '<', 7)
      .where('voice_call_made', '==', false)
      .orderBy('overall_score', 'asc')
      .limit(50)
      .get();

    const candidates = [];

    for (const surveyDoc of surveysSnapshot.docs) {
      const survey = surveyDoc.data();
      
      // Get corresponding appointment
      const appointmentDoc = await db.collection('appointments')
        .doc(survey.appointmentId)
        .get();

      if (appointmentDoc.exists) {
        const appointment = appointmentDoc.data();
        
        // Check business hours (8-17h, Mon-Fri)
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        const isBusinessHours = (day >= 1 && day <= 5) && (hour >= 8 && hour < 17);

        if (isBusinessHours && appointment.phone) {
          candidates.push({
            id: appointmentDoc.id,
            appointmentId: survey.appointmentId,
            patientName: appointment.patientName,
            phone: appointment.phone,
            email: appointment.email,
            doctor: appointment.doctor,
            surveyScore: survey.overall_score,
            surveyFeedback: survey.comment
          });
        }
      }
    }

    res.json({
      success: true,
      data: candidates,
      total: candidates.length,
      message: `Found ${candidates.length} appointments needing voice calls`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/appointments/:id/survey-sent
 * Mark appointment as survey sent
 */
router.patch('/:id/survey-sent', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { survey_sent = true, survey_sent_at } = req.body;

    await db.collection('appointments').doc(id).update({
      survey_sent,
      survey_sent_at: survey_sent_at ? new Date(survey_sent_at) : new Date(),
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: 'Survey status updated',
      data: { id, survey_sent }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments/:id
 * Get specific appointment
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await db.collection('appointments').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    const data = doc.data();
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        startTimeLocal: data.startTimeLocal?.toDate(),
        created_at: data.created_at?.toDate(),
        updated_at: data.updated_at?.toDate()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/appointments/:id
 * Update appointment details
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;

    updates.updated_at = new Date();

    await db.collection('appointments').doc(id).update(updates);

    res.json({
      success: true,
      message: 'Appointment updated',
      data: { id, ...updates }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/dashboard
 * Get dashboard statistics for n8n workflow
 */
router.get('/stats/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get appointments stats
    const appointmentsSnapshot = await db.collection('appointments')
      .where('created_at', '>=', thirtyDaysAgo)
      .get();

    // Get surveys stats
    const surveysSnapshot = await db.collection('surveys')
      .where('submitted_at', '>=', thirtyDaysAgo)
      .get();

    // Get voice calls stats
    const voiceCallsSnapshot = await db.collection('voice_calls')
      .where('created_at', '>=', thirtyDaysAgo)
      .get();

    // Get alerts stats
    const alertsSnapshot = await db.collection('alerts')
      .where('created_at', '>=', thirtyDaysAgo)
      .get();

    let totalScore = 0;
    let lowScoreCount = 0;
    let completedCalls = 0;
    let pendingAlerts = 0;

    surveysSnapshot.forEach(doc => {
      const data = doc.data();
      totalScore += data.overall_score || 0;
      if (data.overall_score < 7) lowScoreCount++;
    });

    voiceCallsSnapshot.forEach(doc => {
      if (doc.data().status === 'completed') completedCalls++;
    });

    alertsSnapshot.forEach(doc => {
      if (doc.data().status === 'pending') pendingAlerts++;
    });

    const stats = {
      period: 'Last 30 Days',
      timestamp: now.toISOString(),
      appointments: {
        total: appointmentsSnapshot.size,
        completed: appointmentsSnapshot.docs.filter(d => d.data().status === 'completed').length,
        pending: appointmentsSnapshot.docs.filter(d => d.data().status === 'pending').length
      },
      surveys: {
        total: surveysSnapshot.size,
        averageScore: surveysSnapshot.size > 0 ? (totalScore / surveysSnapshot.size).toFixed(2) : 0,
        lowScoreCount,
        responseRate: appointmentsSnapshot.size > 0 
          ? ((surveysSnapshot.size / appointmentsSnapshot.size) * 100).toFixed(1) + '%'
          : '0%'
      },
      voiceCalls: {
        total: voiceCallsSnapshot.size,
        completed: completedCalls,
        failed: voiceCallsSnapshot.size - completedCalls
      },
      alerts: {
        total: alertsSnapshot.size,
        pending: pendingAlerts,
        resolved: alertsSnapshot.size - pendingAlerts
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
