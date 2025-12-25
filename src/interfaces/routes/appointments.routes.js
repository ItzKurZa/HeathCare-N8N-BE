import express from 'express';
import { firestore as db } from '../../config/firebase.js';

const router = express.Router();

// ==========================================
// 1. CÁC ROUTE CỤ THỂ (ĐẶT LÊN ĐẦU)
// ==========================================

/**
 * GET /api/appointments/stats/dashboard
 * Đưa lên đầu để tránh bị nhầm là :id
 */
router.get('/stats/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const appointmentsSnapshot = await db.collection('appointments')
      .where('created_at', '>=', thirtyDaysAgo)
      .get();

    const surveysSnapshot = await db.collection('surveys')
      .where('submitted_at', '>=', thirtyDaysAgo)
      .get();

    const voiceCallsSnapshot = await db.collection('voice_calls')
      .where('created_at', '>=', thirtyDaysAgo)
      .get();

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

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments/lookup
 * Tìm kiếm thông minh: Chấp nhận 09xx, 84xx, +84xx
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

    // 1. Chuẩn hóa các biến thể số điện thoại
    const cleanPhone = phone.replace(/\D/g, ''); // Xóa dấu +, khoảng trắng
    let phoneVariations = [];

    if (cleanPhone.startsWith('84')) {
      // Nếu là 84944... -> Thêm 0944... và +84944...
      const localPhone = '0' + cleanPhone.slice(2);
      phoneVariations = [
        cleanPhone,             // 84944...
        '+' + cleanPhone,       // +84944...
        localPhone              // 0944...
      ];
    } else if (cleanPhone.startsWith('0')) {
      // Nếu là 0944... -> Thêm 84944... và +84944...
      const qtPhone = '84' + cleanPhone.slice(1);
      phoneVariations = [
        phone,                  // 0944... (giữ nguyên input gốc)
        cleanPhone,             // 0944... (đã clean)
        qtPhone,                // 84944...
        '+' + qtPhone           // +84944...
      ];
    } else {
      phoneVariations = [phone];
    }

    console.log(`[Lookup] Searching variations:`, phoneVariations);

    // 2. Query Firestore dùng toán tử 'in' (Tìm 1 trong các số này)
    // Lưu ý: Firestore chỉ cho phép tối đa 10 giá trị trong 'in'
    let snapshot = await db.collection('appointments')
      .where('phone', 'in', phoneVariations) 
      .limit(10)
      .get();

    // Fallback: Nếu không tìm thấy ở 'phone', tìm tiếp ở 'patientPhone'
    if (snapshot.empty) {
       console.log(`[Lookup] Not found in 'phone', checking 'patientPhone'...`);
       snapshot = await db.collection('appointments')
        .where('patientPhone', 'in', phoneVariations)
        .limit(10)
        .get();
    }

    // 3. Xử lý kết quả trả về
    if (snapshot.empty) {
      // QUAN TRỌNG: Đây chính là chỗ tạo ra lỗi 404 bạn đang thấy
      console.log(`[Lookup] Failed to find appointment for: ${phone}`);
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy lịch hẹn nào với số: ${phone}`
      });
    }

    // Lấy lịch hẹn mới nhất
    let latestDoc = null;
    let latestDate = null;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Ưu tiên created_at, fallback sang createdAt
      const createdVal = data.created_at || data.createdAt;
      const createdAt = createdVal?.toDate?.() || new Date(0);
      
      if (!latestDate || createdAt > latestDate) {
        latestDate = createdAt;
        latestDoc = { id: doc.id, ...data };
      }
    });

    const data = latestDoc;
    
    // Map dữ liệu trả về frontend
    const appointmentInfo = {
      id: data.id,
      bookingId: data.bookingId || data.id,
      patientName: data.patientName || data.fullName || 'Khách hàng',
      phone: data.phone || data.patientPhone,
      email: data.email || data.patientEmail || '',
      doctorName: data.doctorName || data.doctor || 'Bác sĩ',
      appointmentDate: data.appointmentDate || latestDate?.toISOString(),
      status: data.status || 'unknown'
    };

    return res.json({
      success: true,
      data: appointmentInfo
    });

  } catch (error) {
    console.error('[Lookup Error]:', error);
    next(error);
  }
});

/**
 * GET /api/appointments/completed
 */
router.get('/completed', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
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
        appointmentDate: data.appointmentDate || data.startTimeLocal?.toDate()?.toISOString() || data.created_at?.toDate()?.toISOString(),
        status: data.status,
        survey_completed: data.survey_completed || false
      });
    });

    res.json({ success: true, data: appointments, total: appointments.length });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments/need-voice-call
 */
router.get('/need-voice-call', async (req, res, next) => {
  try {
    const surveysSnapshot = await db.collection('surveys')
      .where('overall_score', '<', 7)
      .where('voice_call_made', '==', false)
      .orderBy('overall_score', 'asc')
      .limit(50)
      .get();

    const candidates = [];
    for (const surveyDoc of surveysSnapshot.docs) {
      const survey = surveyDoc.data();
      const appointmentDoc = await db.collection('appointments').doc(survey.appointmentId).get();

      if (appointmentDoc.exists) {
        const appointment = appointmentDoc.data();
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        const isBusinessHours = (day >= 1 && day <= 5) && (hour >= 8 && hour < 17);

        if (isBusinessHours && (appointment.phone || appointment.patientPhone)) {
          candidates.push({
            id: appointmentDoc.id,
            appointmentId: survey.appointmentId,
            patientName: appointment.patientName || appointment.fullName,
            phone: appointment.phone || appointment.patientPhone,
            email: appointment.email,
            doctor: appointment.doctor || appointment.doctorName,
            surveyScore: survey.overall_score,
            surveyFeedback: survey.comment
          });
        }
      }
    }

    res.json({ success: true, data: candidates, total: candidates.length });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. CÁC ROUTE GỐC HOẶC THAM SỐ (ĐẶT CUỐI)
// ==========================================

/**
 * GET /api/appointments
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

    res.json({ success: true, data: appointments, total: appointments.length });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/appointments/:id/survey-sent
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

    res.json({ success: true, message: 'Survey status updated', data: { id, survey_sent } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments/:id
 * QUAN TRỌNG: Route này phải nằm dưới các route cụ thể như /lookup, /completed, /stats
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('appointments').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
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
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;
    updates.updated_at = new Date();

    await db.collection('appointments').doc(id).update(updates);

    res.json({ success: true, message: 'Appointment updated', data: { id, ...updates } });
  } catch (error) {
    next(error);
  }
});

export default router;