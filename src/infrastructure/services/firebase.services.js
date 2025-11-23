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

export const processBookingService = async (payload) => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  const b = payload || {};

  const id = String(b.id || uuid());
  const submissionId = String(
    b.submissionId || Math.floor(100 + Math.random() * 900) 
  );

  const action = (b.action || 'create').toString().toLowerCase();

  const notify = (() => {
    const x = sanitize(b.notify).toLowerCase();
    if (x === 'email' || x === 'sms' || x === 'both') return x;
    return 'email';
  })();

  const nowISO = () => new Date().toISOString();

  const baseData = {
    __keyValue: id, 
    id,
    submissionId,
    fullName: sanitize(b.fullName),
    phone: sanitize(b.phone),
    email: sanitize(b.email),
    department: sanitize(b.department),
    doctor: sanitize(b.doctor),
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

    console.log(
      `[booking] cancel id=${id} submissionId=${submissionId}`
    );
  } else {
    const startTimeUTC = resolveStartTimeUTC(b);
    const startTimeLocal = sanitize(b.startTimeLocal);

    bookingData.startTimeUTC = startTimeUTC;
    if (startTimeLocal) bookingData.startTimeLocal = startTimeLocal;

    const reminderAt = new Date(
      new Date(startTimeUTC).getTime() - REMINDER_BEFORE_MIN * 60 * 1000
    );
    bookingData.reminderAtUTC = reminderAt.toISOString();

    bookingData.endTimeUTC = '';
    bookingData.status = 'pending';
    bookingData.reminderSentAtUTC = '';

    const createdAtUTC = sanitize(b.createdAtUTC);
    if (action === 'create' && !createdAtUTC) {
      bookingData.createdAtUTC = nowISO();
    } else if (createdAtUTC) {
      bookingData.createdAtUTC = createdAtUTC;
    }

    console.log(
      `[booking] ${action} id=${id} submissionId=${submissionId} startUTC=${startTimeUTC} reminderAtUTC=${bookingData.reminderAtUTC}`
    );
  }
  await firestore
    .collection('appointments')
    .doc(id)
    .set(bookingData, { merge: true });

  return bookingData;
};

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
