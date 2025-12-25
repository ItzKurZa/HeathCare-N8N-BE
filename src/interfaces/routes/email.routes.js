import express from 'express';
import emailService from '../../infrastructure/services/email.services.js';
import { firestore as db } from '../../config/firebase.js';

const router = express.Router();

/**
 * POST /api/emails/send-survey
 * Send survey email to patient
 */
router.post('/send-survey', async (req, res, next) => {
  try {
    const { appointmentId, email, fullName, doctor } = req.body;

    if (!appointmentId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appointmentId and email are required'
      });
    }

    // Generate survey URL
    const surveyUrl = `${process.env.SURVEY_BASE_URL || 'http://localhost:5000/survey'}?id=${appointmentId}`;

    // Send email
    const result = await emailService.sendSurvey({
      to: email,
      patientName: fullName || 'Quý khách',
      doctorName: doctor || 'Bác sĩ',
      surveyUrl,
      appointmentId
    });

    if (result.success) {
      // Log to Firestore
      await db.collection('email_logs').add({
        type: 'survey',
        appointmentId,
        email,
        messageId: result.messageId,
        sentAt: new Date(),
        status: 'sent'
      });

      res.json({
        success: true,
        message: 'Survey email sent successfully',
        data: { 
          emailId: result.messageId,
          surveyUrl 
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/emails/send-reminder
 * Send appointment reminder email
 */
router.post('/send-reminder', async (req, res, next) => {
  try {
    const { appointmentId, email, fullName, doctor, appointmentDate, appointmentTime } = req.body;

    if (!appointmentId || !email || !appointmentDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const result = await emailService.sendAppointmentReminder({
      to: email,
      patientName: fullName || 'Quý khách',
      doctorName: doctor || 'Bác sĩ',
      appointmentDate,
      appointmentTime: appointmentTime || '00:00',
      appointmentId
    });

    if (result.success) {
      await db.collection('email_logs').add({
        type: 'reminder',
        appointmentId,
        email,
        messageId: result.messageId,
        sentAt: new Date(),
        status: 'sent'
      });

      res.json({
        success: true,
        message: 'Reminder email sent successfully',
        data: { emailId: result.messageId }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/emails/send-alert
 * Send CSKH alert email (for low survey scores)
 */
router.post('/send-alert', async (req, res, next) => {
  try {
    const { appointmentId, patientName, score, feedback, analysis } = req.body;

    if (!appointmentId || score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const cskhEmail = process.env.CSKH_EMAIL || 'cskh@healthcare.com';

    const result = await emailService.sendAlert({
      to: cskhEmail,
      patientName: patientName || 'Bệnh nhân',
      appointmentId,
      score,
      feedback: feedback || 'Không có phản hồi',
      analysis: analysis || null
    });

    if (result.success) {
      await db.collection('email_logs').add({
        type: 'alert',
        appointmentId,
        email: cskhEmail,
        messageId: result.messageId,
        sentAt: new Date(),
        status: 'sent',
        metadata: { score, feedback }
      });

      res.json({
        success: true,
        message: 'Alert email sent successfully',
        data: { emailId: result.messageId }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/emails/logs
 * Get email sending history
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { appointmentId, type, limit = 50 } = req.query;

    let query = db.collection('email_logs').orderBy('sentAt', 'desc').limit(parseInt(limit));

    if (appointmentId) {
      query = query.where('appointmentId', '==', appointmentId);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    const logs = [];

    snapshot.forEach(doc => {
      logs.push({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate()
      });
    });

    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/emails/stats
 * Get email statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = db.collection('email_logs');

    if (startDate) {
      query = query.where('sentAt', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('sentAt', '<=', new Date(endDate));
    }

    const snapshot = await query.get();

    const stats = {
      total: 0,
      byType: {
        survey: 0,
        reminder: 0,
        alert: 0
      },
      byStatus: {
        sent: 0,
        failed: 0
      }
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      stats.total++;
      stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
      stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
