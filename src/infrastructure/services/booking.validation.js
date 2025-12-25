import { firestore } from '../../config/firebase.js';

/**
 * Validation service cho booking operations
 */

// Time buffer (phút) để tránh booking quá gần nhau
const TIME_BUFFER_MINUTES = 15;
// Max số booking một user có thể tạo trong 1 ngày
const MAX_BOOKINGS_PER_DAY = 5;

/**
 * Kiểm tra doctor có tồn tại và đang active trong catalog không
 */
export const checkDoctorExistsAndActive = async (doctor, department) => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  if (!doctor || !department) {
    throw new Error('Doctor name and department are required');
  }

  try {
    const snap = await firestore
      .collection('doctors_catalog')
      .where('doctor', '==', doctor.trim())
      .where('department', '==', department.trim())
      .get();

    if (snap.empty) {
      throw new Error(`Doctor "${doctor}" không tồn tại trong khoa "${department}"`);
    }

    // Kiểm tra có ít nhất 1 record active không
    let foundActive = false;
    snap.forEach((doc) => {
      const data = doc.data();
      const status = String(data.status || '').toLowerCase().trim();
      if (status === 'active') {
        foundActive = true;
      }
    });

    if (!foundActive) {
      throw new Error(`Doctor "${doctor}" trong khoa "${department}" hiện không hoạt động`);
    }

    return true;
  } catch (err) {
    // Nếu error message đã có thì throw lại, không thì throw generic error
    if (err.message && (err.message.includes('không tồn tại') || err.message.includes('không hoạt động'))) {
      throw err;
    }
    throw new Error(`Lỗi khi kiểm tra doctor: ${err.message}`);
  }
};

/**
 * Kiểm tra slot thời gian có available không (chưa bị đặt)
 * Kiểm tra xem có booking nào khác đã đặt cùng doctor tại thời điểm đó chưa
 */
export const checkSlotAvailability = async (doctor, startTimeUTC, excludeBookingId = null) => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  if (!doctor || !startTimeUTC) {
    throw new Error('Doctor name and start time are required');
  }

  try {
    // Parse start time
    const appointmentTime = new Date(startTimeUTC);
    if (isNaN(appointmentTime.getTime())) {
      throw new Error('Invalid start time format');
    }

    // Tính time range: 15 phút trước và sau để tránh conflict
    const bufferMs = TIME_BUFFER_MINUTES * 60 * 1000;
    const timeStart = new Date(appointmentTime.getTime() - bufferMs);
    const timeEnd = new Date(appointmentTime.getTime() + bufferMs);

    // Query bookings của doctor trong khoảng thời gian này
    // Chỉ check các booking có status: pending, confirmed (không check canceled, completed)
    let query = firestore
      .collection('appointments')
      .where('doctor', '==', doctor.trim())
      .where('startTimeUTC', '>=', timeStart.toISOString())
      .where('startTimeUTC', '<=', timeEnd.toISOString())
      .where('status', 'in', ['pending', 'confirmed', 'reminded']);

    const snap = await query.get();

    // Filter out excluded booking (cho trường hợp update)
    const conflictingBookings = [];
    snap.forEach((doc) => {
      const bookingId = doc.id;
      // Bỏ qua booking hiện tại nếu đang update
      if (excludeBookingId && bookingId === excludeBookingId) {
        return;
      }
      conflictingBookings.push({
        id: bookingId,
        ...doc.data(),
      });
    });

    if (conflictingBookings.length > 0) {
      const conflict = conflictingBookings[0];
      const conflictTime = conflict.startTimeLocal || conflict.startTimeUTC;
      throw new Error(
        `Thời gian này đã được đặt. Doctor "${doctor}" đã có lịch hẹn vào ${conflictTime}`
      );
    }

    return true;
  } catch (err) {
    // Nếu error message đã có thì throw lại
    if (err.message && err.message.includes('đã được đặt')) {
      throw err;
    }
    throw new Error(`Lỗi khi kiểm tra slot availability: ${err.message}`);
  }
};

/**
 * Kiểm tra user có vượt quá limit booking trong ngày không
 */
export const checkUserBookingLimit = async (userId, date) => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Parse date để lấy start và end của ngày (UTC)
    let targetDate;
    if (date) {
      // date format: "YYYY-MM-DD"
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    } else {
      // Nếu không có date, check ngày hiện tại
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }

    // Tính start và end của ngày (UTC)
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Query bookings của user trong ngày
    const snap = await firestore
      .collection('appointments')
      .where('userId', '==', userId)
      .where('createdAtUTC', '>=', dayStart.toISOString())
      .where('createdAtUTC', '<=', dayEnd.toISOString())
      .get();

    // Đếm số booking (không tính canceled)
    let bookingCount = 0;
    snap.forEach((doc) => {
      const data = doc.data();
      const status = String(data.status || '').toLowerCase();
      if (status !== 'canceled' && status !== 'cancelled') {
        bookingCount++;
      }
    });

    if (bookingCount >= MAX_BOOKINGS_PER_DAY) {
      throw new Error(
        `Bạn đã đạt giới hạn ${MAX_BOOKINGS_PER_DAY} lịch hẹn trong ngày. Vui lòng thử lại vào ngày mai.`
      );
    }

    return true;
  } catch (err) {
    // Nếu error message đã có thì throw lại
    if (err.message && err.message.includes('giới hạn')) {
      throw err;
    }
    throw new Error(`Lỗi khi kiểm tra booking limit: ${err.message}`);
  }
};

/**
 * Kiểm tra duplicate booking (cùng user, doctor, time)
 */
export const checkDuplicateBooking = async (userId, doctor, startTimeUTC, excludeBookingId = null) => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  if (!userId || !doctor || !startTimeUTC) {
    throw new Error('User ID, doctor name, and start time are required');
  }

  try {
    // Parse start time
    const appointmentTime = new Date(startTimeUTC);
    if (isNaN(appointmentTime.getTime())) {
      throw new Error('Invalid start time format');
    }

    // Tính time range: ±1 phút để tìm duplicate
    const timeStart = new Date(appointmentTime.getTime() - 60 * 1000);
    const timeEnd = new Date(appointmentTime.getTime() + 60 * 1000);

    // Query bookings cùng user, doctor, và thời gian
    let query = firestore
      .collection('appointments')
      .where('userId', '==', userId)
      .where('doctor', '==', doctor.trim())
      .where('startTimeUTC', '>=', timeStart.toISOString())
      .where('startTimeUTC', '<=', timeEnd.toISOString());

    const snap = await query.get();

    // Filter out excluded booking và canceled bookings
    const duplicates = [];
    snap.forEach((doc) => {
      const bookingId = doc.id;
      // Bỏ qua booking hiện tại nếu đang update
      if (excludeBookingId && bookingId === excludeBookingId) {
        return;
      }
      const data = doc.data();
      const status = String(data.status || '').toLowerCase();
      // Không tính canceled bookings
      if (status !== 'canceled' && status !== 'cancelled') {
        duplicates.push({
          id: bookingId,
          ...data,
        });
      }
    });

    if (duplicates.length > 0) {
      throw new Error(
        `Bạn đã đặt lịch với doctor "${doctor}" vào thời gian này rồi. Vui lòng chọn thời gian khác.`
      );
    }

    return true;
  } catch (err) {
    // Nếu error message đã có thì throw lại
    if (err.message && (err.message.includes('đã đặt lịch') || err.message.includes('duplicate'))) {
      throw err;
    }
    throw new Error(`Lỗi khi kiểm tra duplicate booking: ${err.message}`);
  }
};

/**
 * Validate toàn bộ booking data trước khi lưu
 * @param {Object} bookingData - Booking data từ request
 * @param {string} excludeBookingId - ID booking cần exclude (cho update case)
 * @returns {Promise<boolean>}
 */
export const validateBookingData = async (bookingData, excludeBookingId = null) => {
  const {
    doctor,
    department,
    userId,
    startTimeUTC,
    startTimeLocal,
    action = 'create',
  } = bookingData;

  // Bỏ qua validation nếu là cancel action
  if (action === 'cancel') {
    return true;
  }

  // 1. Validate required fields
  if (!doctor || !department) {
    throw new Error('Doctor và department là bắt buộc');
  }

  if (!userId) {
    throw new Error('User ID là bắt buộc');
  }

  if (!startTimeUTC && !startTimeLocal) {
    throw new Error('Start time là bắt buộc');
  }

  // 2. Kiểm tra doctor exists và active
  await checkDoctorExistsAndActive(doctor, department);

  // 3. Kiểm tra slot availability (chỉ khi có startTimeUTC)
  if (startTimeUTC) {
    await checkSlotAvailability(doctor, startTimeUTC, excludeBookingId);
  }

  // 4. Kiểm tra duplicate booking
  if (startTimeUTC) {
    await checkDuplicateBooking(userId, doctor, startTimeUTC, excludeBookingId);
  }

  // 5. Kiểm tra user booking limit
  if (startTimeLocal) {
    // Extract date từ startTimeLocal: "YYYY-MM-DD HH:mm"
    const date = startTimeLocal.split(' ')[0];
    await checkUserBookingLimit(userId, date);
  }

  return true;
};

