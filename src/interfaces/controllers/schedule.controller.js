import { getTodayScheduleForAllDoctors } from '../../infrastructure/services/firebase.services.js';

/**
 * Lấy lịch hôm nay cho tất cả bác sĩ (dùng cho N8N automation)
 * Endpoint này không cần auth vì N8N sẽ gọi với API key
 */
export const getTodaySchedule = async (req, res, next) => {
  try {
    const { date, apiKey } = req.query;
    
    // Validate API key (nếu có trong env)
    const validApiKey = process.env.N8N_API_KEY || process.env.SCHEDULE_API_KEY;
    if (validApiKey && apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    // Lấy ngày hôm nay nếu không có date
    const targetDate = date || new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    const schedule = await getTodayScheduleForAllDoctors(targetDate);

    return res.json({
      success: true,
      date: targetDate,
      schedule,
      totalDoctors: schedule.length,
      totalAppointments: schedule.reduce((sum, doc) => sum + (doc.appointments?.length || 0), 0),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lấy lịch hôm nay cho một bác sĩ cụ thể
 */
export const getTodayScheduleForDoctor = async (req, res, next) => {
  try {
    const { doctor, date, apiKey } = req.query;
    
    // Validate API key
    const validApiKey = process.env.N8N_API_KEY || process.env.SCHEDULE_API_KEY;
    if (validApiKey && apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    if (!doctor) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required',
      });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    const schedule = await getTodayScheduleForAllDoctors(targetDate);
    const doctorSchedule = schedule.find(doc => 
      doc.doctor_name === doctor || doc.doctor === doctor
    );

    if (!doctorSchedule) {
      return res.json({
        success: true,
        date: targetDate,
        doctor,
        appointments: [],
        message: 'No appointments found for this doctor',
      });
    }

    return res.json({
      success: true,
      date: targetDate,
      doctor: doctorSchedule.doctor_name || doctorSchedule.doctor,
      appointments: doctorSchedule.appointments || [],
      total: doctorSchedule.appointments?.length || 0,
    });
  } catch (err) {
    next(err);
  }
};
