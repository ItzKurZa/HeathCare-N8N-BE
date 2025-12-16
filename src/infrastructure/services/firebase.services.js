import { firebaseAdmin, firestore } from '../../config/firebase.js';
import { v4 as uuid } from 'uuid';
import { validateBookingData } from './booking.validation.js';

const formatPhoneToE164 = (phone) => {
  if (!phone) return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) return trimmed;

  if (trimmed.startsWith('0')) {
    return '+84' + trimmed.slice(1);
  }

  return trimmed;
};

const sanitize = (v) =>
  v === undefined || v === null ? '' : String(v).trim();

export const createUser = async ({ email, password, fullname, phone, cccd }) => {
  if (!firebaseAdmin || !firebaseAdmin.auth) {
    throw new Error('Firebase Admin not initialized');
  }

  const createParams = {
    email,
    password,
    displayName: fullname || '',
  };

  const formattedPhone = formatPhoneToE164(phone);
  if (formattedPhone) {
    createParams.phoneNumber = formattedPhone;
  }

  const userRecord = await firebaseAdmin.auth().createUser(createParams);

  const userData = {
    uid: userRecord.uid,
    email,
    fullname: fullname || '',
    phone: phone || '',
    cccd: cccd || '',
    createdAt: new Date().toISOString(),
  };

  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  await firestore
    .collection('users')
    .doc(userRecord.uid)
    .set(userData, { merge: true });

  return userData;
};

export const getUserProfile = async (uid) => {
  if (!firestore) return null;

  const doc = await firestore.collection('users').doc(uid).get();
  return doc.exists ? doc.data() : null;
};

export const verifyIdToken = async (idToken) => {
  if (!firebaseAdmin || !firebaseAdmin.auth) {
    throw new Error('Firebase Admin not initialized');
  }
  const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
  return decoded;
};

export const signOutUser = async (uid) => {
  if (!firebaseAdmin || !firebaseAdmin.auth) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    await firebaseAdmin.auth().revokeRefreshTokens(uid);

    const user = await firebaseAdmin.auth().getUser(uid);
    const tokensValidAfterTime =
      new Date(user.tokensValidAfterTime).getTime() / 1000;

    return {
      success: true,
      message: 'User signed out successfully (tokens revoked)',
      tokensValidAfter: tokensValidAfterTime,
    };
  } catch (error) {
    console.error('Sign-out error:', error);
    throw new Error('Error signing out user');
  }
};

const REMINDER_BEFORE_MIN = 2 * 60; // 2 giờ

const localVNToUtcISO = (localStr) => {
  if (!localStr) return '';
  const [date, time] = localStr.trim().split(' ');
  if (!date || !time) return '';
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0, 0)).toISOString();
};

const resolveStartTimeUTC = (payload) => {
  const rawUTC = payload.startTimeUTC && String(payload.startTimeUTC).trim();
  if (rawUTC) {
    const d = new Date(rawUTC);
    if (!isNaN(d)) return d.toISOString();
  }

  const rawLocal =
    payload.startTimeLocal && String(payload.startTimeLocal).trim();
  if (rawLocal) return localVNToUtcISO(rawLocal);

  throw new Error('Missing "startTimeLocal" or "startTimeUTC"');
};


// Convert 09:30 AM → 09:30, 07:15 PM → 19:15
function convert12To24(t) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Invalid appointment_time format: "${t}"`);

  let [, hh, mm, ap] = m;
  let h = parseInt(hh, 10);

  ap = ap.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;

  return `${String(h).padStart(2, '0')}:${mm}`;
}

// Build startTimeLocal = "YYYY-MM-DD HH:mm"
function buildStartTimeLocal(b) {
  const direct = sanitize(b.startTimeLocal);
  if (direct) return direct;

  const date = sanitize(b.appointment_date);
  const time12 = sanitize(b.appointment_time);

  if (!date || !time12) {
    throw new Error('Missing "appointment_date" or "appointment_time"');
  }

  const time24 = convert12To24(time12);
  return `${date} ${time24}`;
}

// Convert local time (VN) → UTC
function localVNToUTC(localStr) {
  const [date, time] = localStr.trim().split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);

  // VN = UTC +7
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0, 0)).toISOString();
}

export const processBookingService = async (payload) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const b = payload || {};

  const id = String(b.id || uuid());
  const submissionId = String(
    b.submissionId || Math.floor(100 + Math.random() * 900)
  );

  const action = (b.action || 'create').toLowerCase();

  const notify = (() => {
    const v = sanitize(b.notify).toLowerCase();
    return ['email', 'sms', 'both'].includes(v) ? v : 'email';
  })();

  const nowISO = () => new Date().toISOString();

  // FE gửi snake_case → map sang camelCase
  const fullName = sanitize(b.fullName || b.full_name);
  const doctor = sanitize(b.doctor || b.doctor_name);
  const userId = sanitize(b.userId || b.user_id);
  // Frontend có thể gửi reason hoặc notes, map sang note
  const note = sanitize(b.note || b.notes || b.reason || '');

  const baseData = {
    __keyValue: id,
    id,
    submissionId,
    userId,
    fullName,
    phone: sanitize(b.phone),
    email: sanitize(b.email),
    department: sanitize(b.department),
    doctor,
    note,
    notify,
    updatedAtUTC: nowISO(),
  };

  let bookingData = { ...baseData };

  if (action === 'cancel') {
    bookingData.status = 'canceled';
    bookingData.endTimeUTC = nowISO();
    bookingData.reminderAtUTC = '';
    bookingData.reminderSentAtUTC = '';

    console.log(`[booking] cancel id=${id} submissionId=${submissionId}`);
  } else {
    // 👉 Build + Convert start time
    const startTimeLocal = buildStartTimeLocal(b);
    const startTimeUTC = localVNToUTC(startTimeLocal);

    bookingData.startTimeLocal = startTimeLocal;
    bookingData.startTimeUTC = startTimeUTC;

    bookingData.endTimeUTC = '';
    bookingData.status = 'pending';
    bookingData.reminderSentAtUTC = '';

    // Reminder (2 giờ trước)
    const reminderAt = new Date(
      new Date(startTimeUTC).getTime() - REMINDER_BEFORE_MIN * 60 * 1000
    );
    bookingData.reminderAtUTC = reminderAt.toISOString();

    // createdAt
    const createdAt = sanitize(b.createdAtUTC);
    bookingData.createdAtUTC = createdAt || nowISO();

    console.log(
      `[booking] ${action} id=${id} submissionId=${submissionId} startLocal=${startTimeLocal} startUTC=${startTimeUTC}`
    );

    // ✅ VALIDATION: Kiểm tra trước khi lưu
    // Xác định đây là update hay create để exclude booking hiện tại
    let excludeBookingId = null;
    if (id && action === 'update') {
      // Kiểm tra booking cũ có tồn tại không
      const existingDoc = await firestore.collection('appointments').doc(id).get();
      if (existingDoc.exists) {
        excludeBookingId = id;
      }
    }

    // Validate booking data
    await validateBookingData(
      {
        doctor,
        department: sanitize(b.department),
        userId,
        startTimeUTC,
        startTimeLocal,
        action,
      },
      excludeBookingId
    );
  }

  const res = await firestore
    .collection('appointments')
    .doc(id)
    .set(bookingData, { merge: true });
  console.log('Firestore write result:', res);
  return bookingData;
}

const normalizeCell = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^=/, '').trim();
};

export const fetchDepartmentsAndDoctors = async () => {
  try {
    const snap = await firestore.collection('doctors_catalog').get();

    // tạm group theo khoa giống bên N8N
    const doctorsByDepartment = {};

    snap.forEach((doc) => {
      const data = doc.data();

      const rawDept = data.department;
      const rawDoctor = data.doctor;
      const rawStatus = data.status;

      const department = normalizeCell(rawDept);
      const doctor = normalizeCell(rawDoctor);
      const status = normalizeCell(rawStatus).toLowerCase(); // "active" / "inactive"

      // chỉ lấy bác sĩ đang active + có đủ dữ liệu
      if (!department || !doctor || status !== 'active') return;

      if (!doctorsByDepartment[department]) {
        doctorsByDepartment[department] = new Set();
      }
      doctorsByDepartment[department].add(doctor);
    });

    // sort theo locale VN cho đẹp
    const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

    // danh sách khoa (string)
    const departments = Object.keys(doctorsByDepartment).sort(collator.compare);

    // flatten thành mảng doctors { name, department_id }
    const doctors = departments.flatMap((dep) =>
      Array.from(doctorsByDepartment[dep])
        .sort(collator.compare)
        .map((name) => ({ name, department_id: dep }))
    );

    return { departments, doctors };
  } catch (err) {
    console.error('❌ Error fetching departments/doctors from Firestore:', err);
    return { departments: [], doctors: [] };
  }
};

export const markRemindersSentService = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) return;

  const nowISO = new Date().toISOString();
  const batch = firestore.batch();

  ids.forEach((id) => {
    const ref = firestore.collection('appointments').doc(id);
    batch.update(ref, {
      reminderSentAtUTC: nowISO,
      updatedAtUTC: nowISO,
      status: 'reminded',
    });
  });

  await batch.commit();
  return { updated: ids.length, reminderSentAtUTC: nowISO };
};

export const getRemindersDueService = async (windowMinutes = 600) => {
  const now = new Date();
  const nowISO = now.toISOString();
  const fromISO = new Date(
    now.getTime() - windowMinutes * 60 * 1000
  ).toISOString();

  const snap = await firestore
    .collection('appointments')
    .where('reminderAtUTC', '>=', fromISO)
    .where('reminderAtUTC', '<=', nowISO)
    .where('status', '==', 'pending')
    .get();

  const items = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.reminderSentAtUTC?.trim()) return;

    items.push({
      id: doc.id,
      ...data,
    });
  });

  return { now: nowISO, items };
};


export const getRecentBookingsService = async ({
  userId,
  page = 1,
  pageSize = 10,
}) => {
  if (!firestore) throw new Error('Firestore not initialized');

  // Chặn page / pageSize bậy bạ
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSizeRaw =
    Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10;
  const safePageSize = Math.min(safePageSizeRaw, 50); // limit tối đa 50/ trang

  const offset = (safePage - 1) * safePageSize;

  // Query: theo userId (nếu có), sort theo createdAtUTC DESC
  // => có thể sẽ cần composite index: userId + createdAtUTC
  let query = firestore
    .collection('appointments')
    .orderBy('createdAtUTC', 'desc');

  if (userId) {
    query = query.where('userId', '==', userId);
  }

  // Lấy thêm 1 record để biết còn trang sau không
  const snap = await query.offset(offset).limit(safePageSize + 1).get();

  const items = [];
  snap.forEach((doc) => {
    items.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  const hasMore = items.length > safePageSize;
  if (hasMore) {
    items.pop(); // bỏ bớt record thứ (pageSize + 1)
  }

  return {
    page: safePage,
    pageSize: safePageSize,
    hasMore,
    items,
  };
};

export const getUserBookingsService = async (userId) => {
  if (!firestore) throw new Error('Firestore not initialized');
  
  const snap = await firestore
    .collection('appointments')
    .where('userId', '==', userId)
    .orderBy('createdAtUTC', 'desc')
    .get();

  const bookings = [];
  snap.forEach((doc) => {
    bookings.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return bookings;
};

export const getBookingByIdService = async (bookingId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const ref = firestore.collection('appointments').doc(bookingId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('Booking not found');
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
};

export const checkInBookingService = async (bookingId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const ref = firestore.collection('appointments').doc(bookingId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('Booking not found');
  }

  const bookingData = doc.data();
  
  // Kiểm tra booking đã bị cancel chưa
  if (bookingData.status === 'canceled') {
    throw new Error('Booking đã bị hủy, không thể check-in');
  }

  // Kiểm tra booking đã check-in chưa
  if (bookingData.checkedInAtUTC) {
    throw new Error('Booking đã được check-in trước đó');
  }

  // Update booking với check-in timestamp
  const updateData = {
    checkedInAtUTC: new Date().toISOString(),
    updatedAtUTC: new Date().toISOString(),
    // Có thể update status thành 'checked_in' hoặc giữ nguyên
    status: bookingData.status === 'pending' ? 'checked_in' : bookingData.status,
  };

  await ref.update(updateData);

  return {
    id: doc.id,
    ...bookingData,
    ...updateData,
  };
};

export const updateBookingService = async (bookingId, updates) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const ref = firestore.collection('appointments').doc(bookingId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('Booking not found');
  }

  const existingData = doc.data();
  const updateData = {
    updatedAtUTC: new Date().toISOString(),
  };

  // Map status từ frontend format sang backend format
  if (updates.status) {
    updateData.status = updates.status === 'cancelled' ? 'canceled' : updates.status;
    
    // Nếu cancel thì set endTimeUTC (không cần validate)
    if (updateData.status === 'canceled') {
      updateData.endTimeUTC = new Date().toISOString();
      updateData.reminderAtUTC = '';
      updateData.reminderSentAtUTC = '';
    }
  }

  // Cập nhật các field khác nếu có
  if (updates.department) updateData.department = sanitize(updates.department);
  if (updates.doctor_name || updates.doctor) updateData.doctor = sanitize(updates.doctor_name || updates.doctor);
  if (updates.notes || updates.note) updateData.note = sanitize(updates.notes || updates.note);
  if (updates.reason) updateData.note = sanitize(updates.reason);

  // ✅ VALIDATION: Nếu update doctor/time và không phải cancel, cần validate
  if (updateData.status !== 'canceled') {
    const newDoctor = updateData.doctor || existingData.doctor;
    const newDepartment = updateData.department || existingData.department;
    
    // Tính toán newStartTimeLocal nếu có thay đổi
    let newStartTimeLocal = existingData.startTimeLocal;
    if (updates.appointment_date && updates.appointment_time) {
      try {
        newStartTimeLocal = `${updates.appointment_date} ${convert12To24(updates.appointment_time)}`;
      } catch (err) {
        // Nếu format không đúng, giữ nguyên thời gian cũ
        console.warn('Invalid appointment_time format in update, keeping existing time:', err.message);
      }
    } else if (updates.appointment_date) {
      // Nếu chỉ có date, giữ nguyên time
      const existingTime = existingData.startTimeLocal ? existingData.startTimeLocal.split(' ')[1] : '09:00';
      newStartTimeLocal = `${updates.appointment_date} ${existingTime}`;
    }
    
    const newStartTimeUTC = newStartTimeLocal && newStartTimeLocal !== existingData.startTimeLocal
      ? localVNToUTC(newStartTimeLocal)
      : existingData.startTimeUTC;

    // Chỉ validate nếu có thay đổi về doctor, department, hoặc time
    const doctorChanged = newDoctor !== existingData.doctor;
    const departmentChanged = newDepartment !== existingData.department;
    const timeChanged = newStartTimeUTC !== existingData.startTimeUTC;

    if (doctorChanged || departmentChanged || timeChanged) {
      // Rebuild payload để validate
      const validationPayload = {
        doctor: newDoctor,
        department: newDepartment,
        userId: existingData.userId,
        startTimeUTC: newStartTimeUTC,
        startTimeLocal: newStartTimeLocal,
        action: 'update',
      };

      // Validate với excludeBookingId để tránh conflict với chính nó
      await validateBookingData(validationPayload, bookingId);

      // Update các field đã tính toán
      if (timeChanged && newStartTimeLocal) {
        updateData.startTimeLocal = newStartTimeLocal;
        updateData.startTimeUTC = newStartTimeUTC;
        
        // Recalculate reminder
        const reminderAt = new Date(
          new Date(newStartTimeUTC).getTime() - REMINDER_BEFORE_MIN * 60 * 1000
        );
        updateData.reminderAtUTC = reminderAt.toISOString();
        updateData.reminderSentAtUTC = ''; // Reset reminder sent khi đổi time
      }
    }
  }

  await ref.update(updateData);

  const updatedDoc = await ref.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  };
};

export const getStatisticsService = async () => {
  if (!firestore) throw new Error('Firestore not initialized');

  // Lấy tất cả appointments
  const appointmentsSnap = await firestore.collection('appointments').get();
  
  // Lấy tất cả users
  const usersSnap = await firestore.collection('users').get();
  
  const appointments = [];
  appointmentsSnap.forEach((doc) => {
    appointments.push(doc.data());
  });

  const totalPatients = usersSnap.size;
  const totalBookings = appointments.length;
  
  const statusCounts = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };

  const departmentCounts = {};
  const dateCounts = {};

  appointments.forEach((booking) => {
    const status = booking.status === 'canceled' ? 'cancelled' : booking.status;
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++;
    }

    if (booking.department) {
      departmentCounts[booking.department] = (departmentCounts[booking.department] || 0) + 1;
    }

    if (booking.startTimeLocal) {
      const date = booking.startTimeLocal.split(' ')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
  });

  const bookingsByDepartment = Object.entries(departmentCounts).map(([department, count]) => ({
    department,
    count,
  }));

  const bookingsByDate = Object.entries(dateCounts).map(([date, count]) => ({
    date,
    count,
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalPatients,
    totalBookings,
    pendingBookings: statusCounts.pending,
    confirmedBookings: statusCounts.confirmed,
    completedBookings: statusCounts.completed,
    cancelledBookings: statusCounts.cancelled,
    bookingsByDepartment,
    bookingsByDate,
  };
};

export const getAllBookingsService = async (filters = {}) => {
  if (!firestore) throw new Error('Firestore not initialized');

  let query = firestore.collection('appointments');

  // Apply filters
  if (filters.status) {
    const status = filters.status === 'cancelled' ? 'canceled' : filters.status;
    query = query.where('status', '==', status);
  }

  if (filters.department) {
    query = query.where('department', '==', filters.department);
  }

  // Note: Firestore doesn't support range queries on multiple fields easily
  // For date filtering, we'll filter in memory if needed
  const snap = await query.orderBy('createdAtUTC', 'desc').get();

  const bookings = [];
  snap.forEach((doc) => {
    const data = doc.data();
    
    // Filter by date if provided
    if (filters.dateFrom || filters.dateTo) {
      if (data.startTimeLocal) {
        const date = data.startTimeLocal.split(' ')[0];
        if (filters.dateFrom && date < filters.dateFrom) return;
        if (filters.dateTo && date > filters.dateTo) return;
      } else {
        return; // Skip if no startTimeLocal
      }
    }

    bookings.push({
      id: doc.id,
      ...data,
    });
  });

  return bookings;
};

export const updateBookingStatusService = async (bookingId, status) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const ref = firestore.collection('appointments').doc(bookingId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('Booking not found');
  }

  const updateData = {
    updatedAtUTC: new Date().toISOString(),
  };

  // Map status từ frontend format sang backend format
  const backendStatus = status === 'cancelled' ? 'canceled' : status;
  updateData.status = backendStatus;

  // Nếu cancel thì set endTimeUTC
  if (backendStatus === 'canceled') {
    updateData.endTimeUTC = new Date().toISOString();
    updateData.reminderAtUTC = '';
    updateData.reminderSentAtUTC = '';
  }

  await ref.update(updateData);

  const updatedDoc = await ref.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  };
};

export const getDoctorBookingsService = async (filters) => {
  if (!firestore) throw new Error('Firestore not initialized');

  let query = firestore
    .collection('appointments')
    .where('doctor', '==', filters.doctor);

  if (filters.status) {
    const status = filters.status === 'cancelled' ? 'canceled' : filters.status;
    query = query.where('status', '==', status);
  }

  const snap = await query.orderBy('createdAtUTC', 'desc').get();

  const bookings = [];
  snap.forEach((doc) => {
    const data = doc.data();

    // Filter by date if provided
    if (filters.dateFrom || filters.dateTo) {
      if (data.startTimeLocal) {
        const date = data.startTimeLocal.split(' ')[0];
        if (filters.dateFrom && date < filters.dateFrom) return;
        if (filters.dateTo && date > filters.dateTo) return;
      } else {
        return; // Skip if no startTimeLocal
      }
    }

    bookings.push({
      id: doc.id,
      ...data,
    });
  });

  return bookings;
};

export const getDoctorScheduleService = async (doctorName, dateFrom, dateTo) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const snap = await firestore
    .collection('appointments')
    .where('doctor', '==', doctorName)
    .where('status', 'in', ['pending', 'confirmed'])
    .orderBy('startTimeUTC', 'asc')
    .get();

  const scheduleByDate = {};

  snap.forEach((doc) => {
    const data = doc.data();
    if (!data.startTimeLocal) return;

    const date = data.startTimeLocal.split(' ')[0];
    const time = data.startTimeLocal.split(' ')[1];

    // Filter by date range
    if (date < dateFrom || date > dateTo) return;

    if (!scheduleByDate[date]) {
      scheduleByDate[date] = [];
    }

    scheduleByDate[date].push({
      time,
      available: false,
      booking_id: doc.id,
    });
  });

  // Convert to array format
  const schedule = Object.entries(scheduleByDate).map(([date, timeSlots]) => ({
    id: `${doctorName}-${date}`,
    doctor_name: doctorName,
    date,
    time_slots: timeSlots,
  }));

  return schedule;
};

export const updateScheduleAvailabilityService = async (doctorName, date, time, available) => {
  // This is a placeholder - in a real system, you might want to store
  // schedule availability separately from bookings
  // For now, we'll just log it
  console.log(`Updating schedule availability for ${doctorName} on ${date} at ${time} to ${available}`);
  
  // In a real implementation, you might:
  // 1. Store availability in a separate collection
  // 2. Update existing bookings if needed
  // 3. Block new bookings for unavailable slots
  
  return { success: true };
};

export const saveMedicalFileMetadata = async (fileMetadata) => {
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore
    .collection('medical_files')
    .doc(fileMetadata.id)
    .set(fileMetadata, { merge: true });

  return fileMetadata;
};

export const getUserFilesService = async (userId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const snap = await firestore
    .collection('medical_files')
    .where('user_id', '==', userId)
    .orderBy('uploaded_at', 'desc')
    .get();

  const files = [];
  snap.forEach((doc) => {
    files.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return files;
};

export const deleteFileService = async (fileId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const ref = firestore.collection('medical_files').doc(fileId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('File not found');
  }

  await ref.delete();
  return { success: true };
};

/**
 * Update booking từ N8N webhook callback
 * @param {Object} payload - Payload từ N8N
 * @param {string} payload.bookingId - ID của booking
 * @param {string} payload.action - Action type
 * @param {string} [payload.status] - New status (optional)
 * @param {string} [payload.reminderSentAtUTC] - Timestamp khi reminder đã gửi
 * @param {string} [payload.notificationMethod] - Method đã gửi (email/sms/both)
 * @param {string} [payload.error] - Error message nếu failed
 * @param {Object} [payload.metadata] - Additional metadata
 */
export const updateBookingFromN8N = async (payload) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const { bookingId, action, status, reminderSentAtUTC, notificationMethod, error, metadata } = payload;

  if (!bookingId) {
    throw new Error('bookingId is required');
  }

  const ref = firestore.collection('appointments').doc(bookingId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('Booking not found');
  }

  const existingData = doc.data();
  const updateData = {
    updatedAtUTC: new Date().toISOString(),
  };

  // Xử lý theo từng action type
  switch (action) {
    case 'notification_sent':
      // Notification đã gửi thành công
      if (reminderSentAtUTC) {
        updateData.reminderSentAtUTC = reminderSentAtUTC;
      } else {
        updateData.reminderSentAtUTC = new Date().toISOString();
      }
      
      // Update status nếu chưa có
      if (!existingData.status || existingData.status === 'pending') {
        updateData.status = 'reminded';
      }

      if (notificationMethod) {
        updateData.notificationMethod = notificationMethod;
      }
      break;

    case 'notification_failed':
      // Notification gửi thất bại
      updateData.notificationError = error || 'Notification failed';
      updateData.notificationFailedAtUTC = new Date().toISOString();
      // Không update status, giữ nguyên để retry sau
      break;

    case 'reminder_sent':
      // Reminder đã gửi (tương tự notification_sent)
      if (reminderSentAtUTC) {
        updateData.reminderSentAtUTC = reminderSentAtUTC;
      } else {
        updateData.reminderSentAtUTC = new Date().toISOString();
      }
      
      if (!existingData.status || existingData.status === 'pending') {
        updateData.status = 'reminded';
      }
      break;

    case 'reminder_failed':
      // Reminder gửi thất bại
      updateData.reminderError = error || 'Reminder failed';
      updateData.reminderFailedAtUTC = new Date().toISOString();
      break;

    case 'booking_confirmed':
      // Booking được confirm tự động (từ N8N logic)
      updateData.status = 'confirmed';
      updateData.confirmedAtUTC = new Date().toISOString();
      updateData.confirmedBy = 'n8n_automation';
      break;

    case 'status_update':
      // Generic status update
      if (status) {
        const validStatuses = ['pending', 'confirmed', 'completed', 'canceled', 'reminded'];
        if (validStatuses.includes(status)) {
          updateData.status = status;
          
          if (status === 'confirmed' && !existingData.confirmedAtUTC) {
            updateData.confirmedAtUTC = new Date().toISOString();
          }
          
          if (status === 'completed' && !existingData.completedAtUTC) {
            updateData.completedAtUTC = new Date().toISOString();
          }
        } else {
          console.warn(`Invalid status from N8N: ${status}`);
        }
      }
      break;

    default:
      console.warn(`Unknown action from N8N: ${action}`);
  }

  // Add metadata nếu có
  if (metadata && typeof metadata === 'object') {
    updateData.n8nMetadata = metadata;
  }

  // Update vào Firestore
  await ref.update(updateData);

  // Log update
  console.log(`[webhook] Updated booking ${bookingId} with action: ${action}`);

  // Return updated data
  const updatedDoc = await ref.get();
  return {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  };
};