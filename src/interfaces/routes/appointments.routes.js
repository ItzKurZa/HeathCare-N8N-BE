import express from 'express';
import { firestore as db } from '../../config/firebase.js';

const router = express.Router();

// Helper function to safely convert Firestore Timestamp or string to Date
const toDateSafe = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value; // Already ISO string
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

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
      const data = doc.data();
      appointments.push({
        id: doc.id,
        ...data,
        startTimeLocal: toDateSafe(data.startTimeLocal),
        created_at: toDateSafe(data.created_at),
        updated_at: toDateSafe(data.updated_at)
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
 * GET /api/appointments/completed
 * Get completed appointments for customer care survey
 */
router.get('/completed', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    // Get appointments that are completed and haven't been surveyed yet
    const snapshot = await db.collection('appointments')
      .where('status', '==', 'completed')
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .get();

    const appointments = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      appointments.push({
        id: doc.id,
        bookingId: data.bookingId || doc.id,
        patientName: data.patientName || data.fullName || 'N/A',
        phone: data.phone || data.patientPhone || 'N/A',
        email: data.email || data.patientEmail,
        doctorName: data.doctorName || data.doctor || 'N/A',
        appointmentDate: data.appointmentDate || toDateSafe(data.startTimeLocal) || toDateSafe(data.created_at),
        status: data.status,
        survey_completed: data.survey_completed || false
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
 * GET /api/appointments/lookup
 * Lookup appointment by phone number - for customer care survey
 */
router.get('/lookup', async (req, res, next) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập số điện thoại'
      });
    }

    console.log('🔍 Looking up appointment for phone:', phone);

    // Normalize phone number - remove special characters and add prefix if needed
    let normalizedPhone = phone.replace(/[^0-9]/g, '');
    let phoneVariants = [normalizedPhone];
    
    // Add variants with different formats
    if (normalizedPhone.startsWith('84')) {
      phoneVariants.push('0' + normalizedPhone.slice(2));
      phoneVariants.push('+' + normalizedPhone);
    } else if (normalizedPhone.startsWith('0')) {
      phoneVariants.push('+84' + normalizedPhone.slice(1));
      phoneVariants.push('84' + normalizedPhone.slice(1));
    }

    console.log('📱 Phone variants to search:', phoneVariants);

    // Search in appointments collection by phone
    let latestDoc = null;
    let latestDate = new Date(0);

    for (const phoneVariant of phoneVariants) {
      const snapshot = await db.collection('appointments')
        .where('phone', '==', phoneVariant)
        .limit(10)
        .get();

      snapshot.forEach(doc => {
        const data = doc.data();
        let createdAt;
        
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (data.created_at?.toDate) {
          createdAt = data.created_at.toDate();
        } else if (typeof data.createdAt === 'string') {
          createdAt = new Date(data.createdAt);
        } else if (typeof data.startTimeLocal === 'string') {
          createdAt = new Date(data.startTimeLocal);
        } else {
          createdAt = new Date();
        }

        if (createdAt > latestDate) {
          latestDate = createdAt;
          latestDoc = { id: doc.id, ...data };
        }
      });
    }

    if (!latestDoc) {
      console.log('❌ No appointment found for phone variants:', phoneVariants);
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy lịch hẹn với số điện thoại này'
      });
    }

    console.log('✅ Found appointment:', latestDoc.id, latestDoc.patientName);

    const data = latestDoc;

    // Format appointment date properly
    let appointmentDateFormatted = '';
    if (data.appointmentDate) {
      appointmentDateFormatted = data.appointmentDate;
    } else if (data.startTimeLocal) {
      try {
        const date = new Date(data.startTimeLocal);
        appointmentDateFormatted = date.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        appointmentDateFormatted = data.startTimeLocal;
      }
    }

    const appointmentInfo = {
      id: data.id,
      bookingId: data.bookingId || data.id,
      patientName: data.patientName || data.fullName || 'N/A',
      phone: data.phone,
      email: data.email || '',
      doctorName: data.doctorName || data.doctor || 'N/A',
      doctorSpecialty: data.doctorSpecialty || data.specialty || '',
      department: data.department || '',
      appointmentDate: appointmentDateFormatted,
      timeSlot: data.timeSlot || '',
      status: data.status || data.visitStatus || 'unknown'
    };

    res.json({
      success: true,
      data: appointmentInfo
    });
  } catch (error) {
    console.error('Lookup error:', error);
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
        startTimeLocal: toDateSafe(data.startTimeLocal),
        created_at: toDateSafe(data.created_at),
        updated_at: toDateSafe(data.updated_at)
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
