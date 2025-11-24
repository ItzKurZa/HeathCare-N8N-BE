import { firebaseAdmin, firestore } from '../../config/firebase.js';
import { v4 as uuid } from 'uuid';

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
    note: sanitize(b.note),
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