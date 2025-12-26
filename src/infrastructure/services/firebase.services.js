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

export const createUser = async ({ email, password, fullname, phone, cccd, role, doctor_name, department, departmentId }) => {
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
    role: role || 'patient', // Mặc định là patient
    createdAt: new Date().toISOString(),
  };

  // Nếu là doctor, thêm thông tin doctor
  if (role === 'doctor') {
    if (doctor_name) userData.doctor_name = doctor_name;
    if (department) userData.department = department;
    if (departmentId) userData.departmentId = departmentId;
  }

  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  await firestore
    .collection('users')
    .doc(userRecord.uid)
    .set(userData, { merge: true });

  // Nếu là doctor, tự động tạo trong doctors_catalog
  if (role === 'doctor' && doctor_name && (department || departmentId)) {
    try {
      // Nếu có departmentId, lấy department name từ departments collection
      let deptName = department;
      if (departmentId && !department) {
        const deptDoc = await firestore.collection('departments').doc(departmentId).get();
        if (deptDoc.exists) {
          deptName = deptDoc.data().name;
        }
      }

      if (deptName) {
        await createOrUpdateDoctorInCatalog({
          doctor: doctor_name,
          department: deptName,
          user_id: userRecord.uid,
          departmentId: departmentId,
        });
      }
    } catch (err) {
      console.error('Warning: Failed to create doctor in catalog:', err.message);
      // Không throw error để không block user creation
    }
  }

  return userData;
};

export const getUserProfile = async (uid) => {
  if (!firestore) return null;

  const doc = await firestore.collection('users').doc(uid).get();
  return doc.exists ? doc.data() : null;
};

/**
 * Tạo hoặc cập nhật doctor trong catalog với user_id và departmentId
 */
export const createOrUpdateDoctorInCatalog = async ({
  doctor,
  department,
  departmentId,
  user_id,
  status = 'active'
}) => {
  if (!firestore) throw new Error('Firestore not initialized');

  if (!doctor || !department) {
    throw new Error('doctor and department are required');
  }

  // Nếu không có departmentId, tìm hoặc tạo department
  let finalDepartmentId = departmentId;
  if (!finalDepartmentId) {
    const deptSnap = await firestore
      .collection('departments')
      .where('name', '==', department.trim())
      .get();

    if (deptSnap.empty) {
      // Tạo department mới
      const deptRef = firestore.collection('departments').doc();
      finalDepartmentId = deptRef.id;
      await deptRef.set({
        id: finalDepartmentId,
        name: department.trim(),
        description: `Khoa ${department.trim()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      finalDepartmentId = deptSnap.docs[0].id;
    }
  }

  // Tìm doctor hiện có (ưu tiên theo user_id, sau đó theo doctor name + department)
  let existingSnap;
  if (user_id) {
    existingSnap = await firestore
      .collection('doctors_catalog')
      .where('user_id', '==', user_id)
      .get();
  }

  if (!existingSnap || existingSnap.empty) {
    existingSnap = await firestore
      .collection('doctors_catalog')
      .where('doctor', '==', doctor.trim())
      .where('department', '==', department.trim())
      .get();
  }

  const now = new Date().toISOString();
  const doctorData = {
    doctor: doctor.trim(),
    department: department.trim(),
    departmentId: finalDepartmentId,  // ✅ Link đến department
    status: status.toLowerCase(),
    user_id: user_id,  // ✅ Link đến user
    updatedAt: now
  };

  if (existingSnap.empty) {
    // Tạo mới
    doctorData.id = firestore.collection('doctors_catalog').doc().id;
    doctorData.createdAt = now;
    const docRef = await firestore.collection('doctors_catalog').doc(doctorData.id);
    await docRef.set(doctorData);
    console.log(`✅ Created doctor in catalog: ${doctor} - ${department} (user_id: ${user_id}, departmentId: ${finalDepartmentId}, doc_id: ${doctorData.id})`);
  } else {
    // Update existing (có thể có nhiều records, update tất cả)
    const batch = firestore.batch();
    existingSnap.docs.forEach(doc => {
      batch.update(doc.ref, doctorData);
    });
    await batch.commit();
    console.log(`✅ Updated ${existingSnap.size} doctor record(s) in catalog: ${doctor} - ${department} (user_id: ${user_id}, departmentId: ${finalDepartmentId})`);
  }

  return doctorData;
};

// Alias để tương thích với code cũ
export const createOrUpdateDoctorCatalog = createOrUpdateDoctorInCatalog;

/**
 * Lấy doctor catalog từ user_id
 */
export const getDoctorCatalogByUserId = async (userId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  if (!userId) {
    return null;
  }

  // Ưu tiên tìm với status = 'active'
  let snap = await firestore
    .collection('doctors_catalog')
    .where('user_id', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  // Nếu không tìm thấy với status active, tìm bất kỳ status nào
  if (snap.empty) {
    snap = await firestore
      .collection('doctors_catalog')
      .where('user_id', '==', userId)
      .limit(1)
      .get();
  }

  if (snap.empty) {
    return null;
  }

  return {
    id: snap.docs[0].id,
    ...snap.docs[0].data()
  };
};

export const updateUserRole = async (uid, newRole, options = {}) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const validRoles = ['patient', 'doctor', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  const userRef = firestore.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const updateData = {
    role: newRole,
    updatedAt: new Date().toISOString(),
  };

  // Nếu là doctor, có thể set thêm doctor_name và department
  if (newRole === 'doctor') {
    if (!options.doctor_name || !options.department) {
      throw new Error('doctor_name and department are required for doctor role');
    }

    // Tìm hoặc tạo department để lấy departmentId
    let departmentId = null;
    const deptSnap = await firestore
      .collection('departments')
      .where('name', '==', options.department.trim())
      .get();

    if (deptSnap.empty) {
      // Tạo department mới
      const deptRef = firestore.collection('departments').doc();
      departmentId = deptRef.id;
      await deptRef.set({
        id: departmentId,
        name: options.department.trim(),
        description: `Khoa ${options.department.trim()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      departmentId = deptSnap.docs[0].id;
    }

    // ✅ Tạo hoặc update doctor trong catalog với user_id và departmentId
    await createOrUpdateDoctorInCatalog({
      doctor: options.doctor_name,
      department: options.department,
      departmentId: departmentId,
      user_id: uid,  // ✅ Link đến user
      status: 'active'
    });

    // Update user profile
    updateData.doctor_name = options.doctor_name;
    updateData.department = options.department;
  }

  await userRef.update(updateData);

  const updatedDoc = await userRef.get();
  return updatedDoc.data();
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
  // Tạo mã đặt lịch 6 ký tự gồm cả chữ và số (A-Z, 0-9)
  const generateSubmissionId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  // Normalize submissionId thành uppercase để đảm bảo consistency
  const submissionId = String(b.submissionId || generateSubmissionId()).toUpperCase().trim();

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

export const getUserBookingsService = async (userId, options = {}) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;

  let query = firestore
    .collection('appointments')
    .where('userId', '==', userId)
    .orderBy('createdAtUTC', 'desc');

  // Get total count
  const totalSnap = await query.get();
  const total = totalSnap.size;

  // Apply pagination
  if (offset > 0) {
    const offsetSnap = await query.limit(offset).get();
    const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
  }

  const snap = await query.limit(limit).get();

  const bookings = [];
  snap.forEach((doc) => {
    bookings.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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

export const getBookingBySubmissionIdService = async (submissionId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  // Normalize submissionId thành uppercase để tìm kiếm
  const searchId = String(submissionId).toUpperCase().trim();
  console.log(`[getBookingBySubmissionIdService] Searching for submissionId: "${searchId}"`);

  // Tìm kiếm với cả uppercase và case-insensitive (thử cả 2 cách)
  let snap = await firestore
    .collection('appointments')
    .where('submissionId', '==', searchId)
    .limit(1)
    .get();

  // Nếu không tìm thấy với uppercase, thử tìm với case-insensitive bằng cách query tất cả và filter
  if (snap.empty) {
    console.log(`[getBookingBySubmissionIdService] Not found with exact match, trying case-insensitive search`);
    // Query tất cả và filter (chỉ dùng khi cần thiết vì không hiệu quả)
    const allSnap = await firestore
      .collection('appointments')
      .limit(1000) // Giới hạn để tránh query quá nhiều
      .get();

    const foundDoc = allSnap.docs.find(doc => {
      const data = doc.data();
      const docSubmissionId = String(data.submissionId || '').toUpperCase().trim();
      return docSubmissionId === searchId;
    });

    if (foundDoc) {
      const bookingData = {
        id: foundDoc.id,
        ...foundDoc.data(),
      };
      console.log(`[getBookingBySubmissionIdService] Found booking (case-insensitive): id=${bookingData.id}, submissionId=${bookingData.submissionId}`);
      return bookingData;
    }
  } else {
    const doc = snap.docs[0];
    const bookingData = {
      id: doc.id,
      ...doc.data(),
    };
    console.log(`[getBookingBySubmissionIdService] Found booking: id=${bookingData.id}, submissionId=${bookingData.submissionId}`);
    return bookingData;
  }

  console.log(`[getBookingBySubmissionIdService] No booking found with submissionId: "${searchId}"`);
  throw new Error('Booking not found');
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

  // Kiểm tra thời gian check-in: chỉ cho phép check-in trước giờ khám 15 phút
  if (bookingData.startTimeUTC) {
    const appointmentTime = new Date(bookingData.startTimeUTC);
    const now = new Date();
    const fifteenMinutesBefore = new Date(appointmentTime.getTime() - 15 * 60 * 1000); // 15 phút trước giờ khám

    console.log(`[checkInBookingService] Appointment time: ${appointmentTime.toISOString()}`);
    console.log(`[checkInBookingService] Current time: ${now.toISOString()}`);
    console.log(`[checkInBookingService] 15 minutes before: ${fifteenMinutesBefore.toISOString()}`);

    // Kiểm tra nếu quá sớm (trước 15 phút)
    if (now < fifteenMinutesBefore) {
      const minutesUntilAllowed = Math.ceil((fifteenMinutesBefore.getTime() - now.getTime()) / (60 * 1000));
      throw new Error(`Chỉ có thể check-in trước giờ khám 15 phút. Vui lòng quay lại sau ${minutesUntilAllowed} phút nữa.`);
    }

    // Kiểm tra nếu quá muộn (sau giờ khám)
    if (now > appointmentTime) {
      throw new Error('Đã quá giờ khám. Vui lòng liên hệ phòng khám để được hỗ trợ.');
    }
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

  // Xử lý note/reason: reason có priority cao hơn notes
  if (updates.reason) {
    updateData.note = sanitize(updates.reason);
  } else if (updates.notes || updates.note) {
    updateData.note = sanitize(updates.notes || updates.note);
  }

  // Nếu update doctor/time và không phải cancel, cần validate
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
  const updatedBookingData = {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  };
    const { sendCancelBookingEmail, sendUpdateBookingEmail } = await import('./n8n.services.js');

  // Gửi email thông báo hủy lịch nếu status = canceled
  if (updateData.status === 'canceled') {
    try {
      // Gửi email bất đồng bộ (không chờ kết quả)
      sendCancelBookingEmail(updatedBookingData).catch(err => {
        console.error('❌ Failed to send cancel booking email:', err.message);
      });
    } catch (err) {
      console.error('❌ Error importing sendCancelBookingEmail:', err.message);
    }
  } else {
    console.log('Booking updated, sending update email...');
      sendUpdateBookingEmail(updatedBookingData, [`Trạng thái: ${updateData.status} → ${updateData.status}`]).catch(err => {
          console.error('❌ Failed to send update booking email:', err.message);
        });
    }

  return updatedBookingData;
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

    // Xử lý startTimeLocal an toàn - có thể là string, Date object, hoặc timestamp
    if (booking.startTimeLocal) {
      let dateStr = '';

      if (typeof booking.startTimeLocal === 'string') {
        // Nếu là string, split để lấy date
        dateStr = booking.startTimeLocal.split(' ')[0];
      } else if (booking.startTimeLocal instanceof Date) {
        // Nếu là Date object, format thành YYYY-MM-DD
        const year = booking.startTimeLocal.getFullYear();
        const month = String(booking.startTimeLocal.getMonth() + 1).padStart(2, '0');
        const day = String(booking.startTimeLocal.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof booking.startTimeLocal === 'number' || booking.startTimeLocal.toDate) {
        // Nếu là timestamp hoặc Firestore Timestamp
        const date = booking.startTimeLocal.toDate ? booking.startTimeLocal.toDate() : new Date(booking.startTimeLocal);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
      }

      if (dateStr) {
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
      }
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

export const updateBookingStatusService = async (bookingId, updates) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const ref = firestore.collection('appointments').doc(bookingId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error('Booking not found');
  }

  const updateData = {
    updatedAtUTC: new Date().toISOString(),
  };

  // Nếu có status, cập nhật status
  if (updates.status) {
    const backendStatus = updates.status === 'cancelled' ? 'canceled' : updates.status;
    updateData.status = backendStatus;

    // Nếu cancel thì set endTimeUTC
    if (backendStatus === 'canceled') {
      updateData.endTimeUTC = new Date().toISOString();
      updateData.reminderAtUTC = '';
      updateData.reminderSentAtUTC = '';
    }
  }

  // Nếu có medical_record, cập nhật hồ sơ bệnh án
  if (updates.medical_record !== undefined) {
    updateData.medical_record = String(updates.medical_record || '').trim();
  }

  const existingDataBeforeUpdate = doc.data(); // Lưu data cũ để so sánh

  await ref.update(updateData);

  const updatedDoc = await ref.get();
  const updatedBookingData = {
    id: updatedDoc.id,
    ...updatedDoc.data(),
  };

  // ✅ Gửi email thông báo
  try {
    const { sendCancelBookingEmail, sendUpdateBookingEmail } = await import('./n8n.services.js');

    if (updateData.status === 'canceled') {
      // Gửi email hủy lịch
      sendCancelBookingEmail(updatedBookingData).catch(err => {
        console.error('❌ Failed to send cancel booking email:', err.message);
      });
    } else if (Object.keys(updateData).length > 1 && updateData.status) {
      // Gửi email cập nhật status (nếu không phải cancel)
      // Note: updateBookingStatusService chỉ update status hoặc medical_record
      // Không có thay đổi về time/doctor/department nên không cần detect changes
      // Chỉ gửi email nếu status thay đổi (không phải cancel)
      if (updateData.status !== existingDataBeforeUpdate.status && updateData.status !== 'canceled') {
        sendUpdateBookingEmail(updatedBookingData, [`Trạng thái: ${existingDataBeforeUpdate.status} → ${updateData.status}`]).catch(err => {
          console.error('❌ Failed to send update booking email:', err.message);
        });
      }
    }
  } catch (err) {
    console.error('❌ Error importing email functions:', err.message);
  }

  return updatedBookingData;
};

export const getDoctorBookingsService = async (filters) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const doctorName = filters.doctor;
  const { page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  if (!doctorName) {
    throw new Error('Doctor name is required');
  }

  // Theo RBAC model: Doctor chỉ xem lịch của chính mình (không xem lịch trong khoa)
  // Filter trực tiếp theo doctor name
  let query = firestore
    .collection('appointments')
    .where('doctor', '==', doctorName);

  if (filters.status) {
    const status = filters.status === 'cancelled' ? 'canceled' : filters.status;
    query = query.where('status', '==', status);
  }

  // Get total count (before pagination)
  const totalSnap = await query.orderBy('createdAtUTC', 'desc').get();
  let totalBookings = [];
  totalSnap.forEach((doc) => {
    const data = doc.data();
    // Filter by date if provided
    if (filters.dateFrom || filters.dateTo) {
      if (data.startTimeLocal) {
        const date = typeof data.startTimeLocal === 'string'
          ? data.startTimeLocal.split(' ')[0]
          : '';
        if (filters.dateFrom && date < filters.dateFrom) return;
        if (filters.dateTo && date > filters.dateTo) return;
      } else {
        return; // Skip if no startTimeLocal
      }
    }
    totalBookings.push(doc.id);
  });
  const total = totalBookings.length;

  // Apply pagination
  query = query.orderBy('createdAtUTC', 'desc');
  if (offset > 0) {
    const offsetSnap = await query.limit(offset).get();
    const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
  }

  const snap = await query.limit(limit).get();

  const bookings = [];
  snap.forEach((doc) => {
    const data = doc.data();

    // Filter by date if provided
    if (filters.dateFrom || filters.dateTo) {
      if (data.startTimeLocal) {
        const date = typeof data.startTimeLocal === 'string'
          ? data.startTimeLocal.split(' ')[0]
          : '';
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

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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

/**
 * Lấy lịch hôm nay cho tất cả bác sĩ (dùng cho N8N automation)
 * @param {string} targetDate - Format: YYYY-MM-DD (mặc định: hôm nay)
 * @returns {Promise<Array>} Array of doctor schedules with appointments
 */
export const getTodayScheduleForAllDoctors = async (targetDate) => {
  if (!firestore) throw new Error('Firestore not initialized');

  // Parse target date hoặc dùng hôm nay
  const date = targetDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Lấy tất cả bác sĩ active từ doctors_catalog
  const doctorsSnap = await firestore
    .collection('doctors_catalog')
    .where('status', '==', 'active')
    .get();

  const doctors = [];
  doctorsSnap.forEach((doc) => {
    const data = doc.data();
    doctors.push({
      doctor_id: doc.id,
      doctor_name: data.doctor,
      department: data.department,
      departmentId: data.departmentId,
      user_id: data.user_id,
    });
  });

  // Lấy tất cả appointments của ngày hôm nay
  const startOfDay = `${date} 00:00`;
  const endOfDay = `${date} 23:59`;

  // Query appointments cho ngày này
  // Note: Firestore không hỗ trợ range query trên string, nên cần query tất cả và filter
  const appointmentsSnap = await firestore
    .collection('appointments')
    .where('status', 'in', ['pending', 'confirmed'])
    .get();

  // Filter appointments theo date và group theo doctor
  const appointmentsByDoctor = {};

  appointmentsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.startTimeLocal) return;

    const appointmentDate = data.startTimeLocal.split(' ')[0];
    if (appointmentDate !== date) return;

    const doctorName = data.doctor;
    if (!doctorName) return;

    if (!appointmentsByDoctor[doctorName]) {
      appointmentsByDoctor[doctorName] = [];
    }

    // Parse time từ startTimeLocal
    const timePart = data.startTimeLocal.split(' ')[1] || '';
    const [hours, minutes] = timePart.split(':');
    const time24 = `${hours}:${minutes}`;

    appointmentsByDoctor[doctorName].push({
      id: doc.id,
      submissionId: data.submissionId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      time: time24,
      time12: convert24To12(time24),
      status: data.status,
      reason: data.note || 'Khám bệnh',
    });
  });

  // Sort appointments theo thời gian
  Object.keys(appointmentsByDoctor).forEach((doctorName) => {
    appointmentsByDoctor[doctorName].sort((a, b) => {
      const [aH, aM] = a.time.split(':').map(Number);
      const [bH, bM] = b.time.split(':').map(Number);
      return aH * 60 + aM - (bH * 60 + bM);
    });
  });

  // Lấy email của từng bác sĩ từ users collection
  const doctorUserIds = doctors.filter(d => d.user_id).map(d => d.user_id);
  const userEmailsMap = {};

  if (doctorUserIds.length > 0) {
    // Batch get users để lấy email
    const userPromises = doctorUserIds.map(async (userId) => {
      try {
        const userDoc = await firestore.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return { userId, email: userData.email || null };
        }
        return { userId, email: null };
      } catch (error) {
        console.warn(`⚠️ Error fetching user email for ${userId}:`, error.message);
        return { userId, email: null };
      }
    });

    const userResults = await Promise.all(userPromises);
    userResults.forEach(({ userId, email }) => {
      userEmailsMap[userId] = email;
    });
  }

  // Map doctors với appointments và email
  const result = doctors.map((doctor) => ({
    doctor_id: doctor.doctor_id,
    doctor_name: doctor.doctor_name,
    department: doctor.department,
    departmentId: doctor.departmentId,
    user_id: doctor.user_id,
    email: doctor.user_id ? (userEmailsMap[doctor.user_id] || null) : null,
    appointments: appointmentsByDoctor[doctor.doctor_name] || [],
    total: appointmentsByDoctor[doctor.doctor_name]?.length || 0,
  }));

  // Sort theo số lượng appointments (nhiều nhất trước)
  result.sort((a, b) => b.total - a.total);

  return result;
};

// Helper function để convert 24h format sang 12h format
const convert24To12 = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

export const getFileByIdService = async (fileId) => {
  if (!firestore) throw new Error('Firestore not initialized');

  const doc = await firestore.collection('medical_files').doc(fileId).get();

  if (!doc.exists) {
    throw new Error('File not found in database');
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
}
/**
 * Lấy danh sách tất cả departments với thông tin chi tiết
 * Bao gồm: số lượng doctors, số lượng bookings, bookings theo status
 */
export const getAllDepartmentsService = async () => {
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    // Lấy tất cả departments
    const departmentsSnap = await firestore.collection('departments').get();
    
    // Lấy tất cả doctors để đếm số lượng
    const doctorsSnap = await firestore.collection('doctors_catalog').get();
    
    // Lấy tất cả appointments để đếm số lượng bookings
    const appointmentsSnap = await firestore.collection('appointments').get();

    // Tạo map để đếm số lượng doctors và bookings theo department
    const doctorsCountByDept = {};
    const activeDoctorsCountByDept = {};
    const bookingsCountByDept = {};
    const bookingsByStatusByDept = {}; // { department: { pending: 0, confirmed: 0, ... } }

    // Đếm doctors
    doctorsSnap.forEach((doc) => {
      const data = doc.data();
      const dept = (data.department || '').trim();
      if (dept) {
        doctorsCountByDept[dept] = (doctorsCountByDept[dept] || 0) + 1;
        if (data.status === 'active') {
          activeDoctorsCountByDept[dept] = (activeDoctorsCountByDept[dept] || 0) + 1;
        }
      }
    });

    // Đếm bookings
    appointmentsSnap.forEach((doc) => {
      const data = doc.data();
      const dept = (data.department || '').trim();
      if (dept) {
        bookingsCountByDept[dept] = (bookingsCountByDept[dept] || 0) + 1;
        
        if (!bookingsByStatusByDept[dept]) {
          bookingsByStatusByDept[dept] = {
            pending: 0,
            confirmed: 0,
            completed: 0,
            canceled: 0,
            reminded: 0,
          };
        }
        
        const status = data.status || 'pending';
        if (bookingsByStatusByDept[dept][status] !== undefined) {
          bookingsByStatusByDept[dept][status]++;
        }
      }
    });

    // Build departments list với thông tin chi tiết
    const departments = [];
    departmentsSnap.forEach((doc) => {
      const data = doc.data();
      const deptName = data.name || '';
      
      departments.push({
        id: doc.id,
        name: deptName,
        description: data.description || '',
        totalDoctors: doctorsCountByDept[deptName] || 0,
        activeDoctors: activeDoctorsCountByDept[deptName] || 0,
        totalBookings: bookingsCountByDept[deptName] || 0,
        bookingsByStatus: bookingsByStatusByDept[deptName] || {
          pending: 0,
          confirmed: 0,
          completed: 0,
          canceled: 0,
          reminded: 0,
        },
        createdAt: data.createdAt || data.created_at || null,
        updatedAt: data.updatedAt || data.updated_at || null,
      });
    });

    // Sort theo tên (Vietnamese locale)
    const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });
    departments.sort((a, b) => collator.compare(a.name, b.name));

    return departments;
  } catch (err) {
    console.error('❌ Error fetching departments:', err);
    throw err;
  }
};