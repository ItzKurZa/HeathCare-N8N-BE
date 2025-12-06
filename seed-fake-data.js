/**
 * Script tạo 20 dòng dữ liệu giả cho hệ thống Healthcare CSKH
 * Bao gồm: appointments, surveys, voice_calls, alerts
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account
const serviceAccountPath = join(__dirname, 'src/config/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ==================== DỮ LIỆU MẪU ====================

// Danh sách bệnh nhân (20 người)
const patients = [
  { name: 'Nguyễn Thị Nguyên', phone: '0343107931', email: 'nguyennt2.22it@vku.udn.vn' },
  { name: 'Trần Văn Minh', phone: '0912345678', email: 'minhtv@gmail.com' },
  { name: 'Lê Thị Hồng', phone: '0987654321', email: 'honglt@yahoo.com' },
  { name: 'Phạm Đức Anh', phone: '0909123456', email: 'anhpd@outlook.com' },
  { name: 'Hoàng Thị Mai', phone: '0933445566', email: 'maiht@gmail.com' },
  { name: 'Ngô Văn Tùng', phone: '0977889900', email: 'tungnv@gmail.com' },
  { name: 'Đặng Thị Lan', phone: '0944556677', email: 'landt@hotmail.com' },
  { name: 'Bùi Quốc Việt', phone: '0966778899', email: 'vietbq@gmail.com' },
  { name: 'Vũ Thị Hạnh', phone: '0922334455', email: 'hanhvt@yahoo.com' },
  { name: 'Đinh Văn Phong', phone: '0955667788', email: 'phongdv@gmail.com' },
  { name: 'Lý Thị Thảo', phone: '0988990011', email: 'thaolt@gmail.com' },
  { name: 'Trịnh Minh Tuấn', phone: '0911223344', email: 'tuantm@outlook.com' },
  { name: 'Cao Thị Bích', phone: '0899001122', email: 'bichct@gmail.com' },
  { name: 'Dương Văn Hải', phone: '0866778899', email: 'haidv@yahoo.com' },
  { name: 'Phan Thị Yến', phone: '0877889900', email: 'yenpt@gmail.com' },
  { name: 'Hồ Đức Thắng', phone: '0833445566', email: 'thanghd@gmail.com' },
  { name: 'Nguyễn Văn Long', phone: '0844556677', email: 'longnv@hotmail.com' },
  { name: 'Trần Thị Nhung', phone: '0855667788', email: 'nhungtt@gmail.com' },
  { name: 'Lê Văn Cường', phone: '0822334455', email: 'cuonglv@outlook.com' },
  { name: 'Phạm Thị Dung', phone: '0811223344', email: 'dungpt@gmail.com' }
];

// Danh sách bác sĩ
const doctors = [
  { name: 'BS. Nguyễn Văn An', specialty: 'Nội tổng quát' },
  { name: 'BS. Trần Thị Bình', specialty: 'Tim mạch' },
  { name: 'BS. Lê Hoàng Cường', specialty: 'Nhi khoa' },
  { name: 'BS. Phạm Minh Đức', specialty: 'Da liễu' },
  { name: 'BS. Hoàng Thị Nga', specialty: 'Sản phụ khoa' },
  { name: 'BS. Vũ Đình Hùng', specialty: 'Chấn thương chỉnh hình' },
  { name: 'BS. Đặng Thu Hà', specialty: 'Mắt' },
  { name: 'BS. Ngô Quang Vinh', specialty: 'Tai mũi họng' }
];

// Các khung giờ khám
const timeSlots = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'];

// Lý do khám
const reasons = [
  'Khám tổng quát định kỳ',
  'Đau đầu kéo dài',
  'Kiểm tra huyết áp',
  'Đau bụng',
  'Ho và sốt',
  'Khám da',
  'Đau lưng',
  'Khám mắt định kỳ',
  'Viêm họng',
  'Khám thai định kỳ'
];

// Staff attitude options
const staffAttitudes = ['Rất tốt', 'Tốt', 'Bình thường', 'Chưa tốt'];
const waitingTimes = ['Dưới 15 phút', '15-30 phút', '30-60 phút', 'Trên 60 phút'];

// Random helpers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (arr) => arr[randomInt(0, arr.length - 1)];
const randomDate = (daysBack) => {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysBack));
  return date;
};

// Generate booking ID
const generateBookingId = () => `BK${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`;

// ==================== TẠO DỮ LIỆU ====================

async function seedData() {
  console.log('🚀 Bắt đầu tạo dữ liệu giả...\n');
  
  const batch = db.batch();
  const appointments = [];
  const surveys = [];
  const voiceCalls = [];
  const alerts = [];

  // 1. Tạo 20 appointments (lịch hẹn đã hoàn thành)
  console.log('📅 Tạo 20 lịch hẹn...');
  for (let i = 0; i < 20; i++) {
    const patient = patients[i];
    const doctor = randomElement(doctors);
    const appointmentDate = randomDate(30);
    const bookingId = generateBookingId();
    
    const appointment = {
      bookingId,
      patientName: patient.name,
      phone: patient.phone,
      email: patient.email,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      appointmentDate: appointmentDate.toISOString().split('T')[0],
      timeSlot: randomElement(timeSlots),
      reason: randomElement(reasons),
      status: 'completed',
      createdAt: admin.firestore.Timestamp.fromDate(appointmentDate),
      completedAt: admin.firestore.Timestamp.fromDate(appointmentDate)
    };
    
    const docRef = db.collection('appointments').doc();
    batch.set(docRef, appointment);
    appointments.push({ id: docRef.id, ...appointment });
    console.log(`   ✓ ${patient.name} - ${doctor.name} (${appointment.appointmentDate})`);
  }

  // 2. Tạo 15 surveys (một số lịch hẹn chưa được khảo sát)
  console.log('\n📝 Tạo 15 khảo sát...');
  const surveyedAppointments = appointments.slice(0, 15);
  
  for (let i = 0; i < surveyedAppointments.length; i++) {
    const apt = surveyedAppointments[i];
    const nps = randomInt(1, 10);
    const csat = randomInt(1, 5);
    const facility = randomInt(1, 5);
    
    const survey = {
      bookingId: apt.bookingId,
      appointmentId: apt.id,
      patientName: apt.patientName,
      phone: apt.phone,
      email: apt.email,
      doctorName: apt.doctorName,
      nps,
      csat,
      facility,
      staff_attitude: {
        doctor_label: randomElement(staffAttitudes),
        reception_label: randomElement(staffAttitudes),
        nurse_label: randomElement(staffAttitudes)
      },
      waiting_time: randomElement(waitingTimes),
      comment: generateComment(nps),
      surveyType: i < 10 ? 'form' : 'voice',
      status: 'completed',
      createdAt: admin.firestore.Timestamp.fromDate(randomDate(25)),
      submittedAt: admin.firestore.Timestamp.now()
    };
    
    const docRef = db.collection('surveys').doc();
    batch.set(docRef, survey);
    surveys.push({ id: docRef.id, ...survey });
    
    const emoji = nps >= 7 ? '😊' : nps >= 5 ? '😐' : '😞';
    console.log(`   ${emoji} ${apt.patientName} - NPS: ${nps}, CSAT: ${csat}`);
  }

  // 3. Tạo 8 voice calls
  console.log('\n📞 Tạo 8 cuộc gọi voice...');
  const calledPatients = patients.slice(10, 18);
  
  for (let i = 0; i < calledPatients.length; i++) {
    const patient = calledPatients[i];
    const status = i < 6 ? 'completed' : (i < 7 ? 'failed' : 'pending');
    const duration = status === 'completed' ? randomInt(60, 300) : 0;
    
    const voiceCall = {
      patientName: patient.name,
      phone: patient.phone,
      email: patient.email,
      status,
      duration,
      transcript: status === 'completed' ? generateTranscript(patient.name) : null,
      agentId: 'mock_agent_id',
      callId: `call_${Date.now().toString(36)}_${i}`,
      initiatedAt: admin.firestore.Timestamp.fromDate(randomDate(15)),
      completedAt: status === 'completed' ? admin.firestore.Timestamp.now() : null
    };
    
    const docRef = db.collection('voice_calls').doc();
    batch.set(docRef, voiceCall);
    voiceCalls.push({ id: docRef.id, ...voiceCall });
    
    const statusEmoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳';
    console.log(`   ${statusEmoji} ${patient.name} - ${status} (${duration}s)`);
  }

  // 4. Tạo 10 alerts
  console.log('\n🚨 Tạo 10 cảnh báo...');
  const alertTypes = [
    { type: 'low_nps', severity: 'high', message: 'Điểm NPS thấp (≤3)' },
    { type: 'negative_feedback', severity: 'high', message: 'Phản hồi tiêu cực từ khách hàng' },
    { type: 'long_wait', severity: 'medium', message: 'Thời gian chờ quá lâu' },
    { type: 'staff_complaint', severity: 'medium', message: 'Khiếu nại về thái độ nhân viên' },
    { type: 'facility_issue', severity: 'low', message: 'Vấn đề cơ sở vật chất' }
  ];

  for (let i = 0; i < 10; i++) {
    const alertType = randomElement(alertTypes);
    const patient = randomElement(patients);
    const isResolved = i < 4;
    
    const alert = {
      type: alertType.type,
      severity: alertType.severity,
      message: alertType.message,
      patientName: patient.name,
      phone: patient.phone,
      details: `Bệnh nhân ${patient.name} - ${alertType.message}`,
      status: isResolved ? 'resolved' : 'pending',
      createdAt: admin.firestore.Timestamp.fromDate(randomDate(20)),
      resolvedAt: isResolved ? admin.firestore.Timestamp.now() : null,
      resolvedBy: isResolved ? 'Admin CSKH' : null
    };
    
    const docRef = db.collection('alerts').doc();
    batch.set(docRef, alert);
    alerts.push({ id: docRef.id, ...alert });
    
    const severityEmoji = alertType.severity === 'high' ? '🔴' : alertType.severity === 'medium' ? '🟡' : '🟢';
    console.log(`   ${severityEmoji} ${alertType.type} - ${patient.name} (${alert.status})`);
  }

  // Commit all data
  console.log('\n💾 Đang lưu dữ liệu vào Firebase...');
  await batch.commit();
  
  console.log('\n✅ HOÀN THÀNH!');
  console.log('=====================================');
  console.log(`📅 Lịch hẹn:     ${appointments.length}`);
  console.log(`📝 Khảo sát:     ${surveys.length}`);
  console.log(`📞 Cuộc gọi:     ${voiceCalls.length}`);
  console.log(`🚨 Cảnh báo:     ${alerts.length}`);
  console.log('=====================================');
  
  console.log('\n📋 THÔNG TIN TEST:');
  console.log('-------------------');
  console.log('Bệnh nhân mẫu để test tra cứu:');
  console.log(`  👤 Nguyễn Thị Nguyên`);
  console.log(`  📞 0343107931`);
  console.log(`  📧 nguyennt2.22it@vku.udn.vn`);
  console.log(`  🏥 Bác sĩ: ${appointments[0].doctorName}`);
  console.log(`  📅 Ngày khám: ${appointments[0].appointmentDate}`);
  
  process.exit(0);
}

// Generate comment based on NPS
function generateComment(nps) {
  const positiveComments = [
    'Dịch vụ rất tốt, bác sĩ nhiệt tình và chu đáo.',
    'Nhân viên thân thiện, cơ sở vật chất sạch sẽ.',
    'Rất hài lòng với chất lượng khám bệnh.',
    'Bác sĩ giải thích rõ ràng, dễ hiểu.',
    'Thời gian chờ nhanh, quy trình thuận tiện.'
  ];
  
  const neutralComments = [
    'Dịch vụ ổn, có thể cải thiện thêm.',
    'Thời gian chờ hơi lâu nhưng chấp nhận được.',
    'Bác sĩ khám tốt, nhưng lễ tân cần thân thiện hơn.',
    'Cơ sở vật chất cũ, cần nâng cấp.',
    ''
  ];
  
  const negativeComments = [
    'Thời gian chờ quá lâu, nhân viên thiếu nhiệt tình.',
    'Cần cải thiện thái độ phục vụ.',
    'Quy trình khám rườm rà, mất nhiều thời gian.',
    'Không hài lòng với cách giải quyết của nhân viên.',
    'Cơ sở vật chất xuống cấp, cần sửa chữa.'
  ];
  
  if (nps >= 7) return randomElement(positiveComments);
  if (nps >= 5) return randomElement(neutralComments);
  return randomElement(negativeComments);
}

// Generate transcript for voice call
function generateTranscript(patientName) {
  return `[AI] Xin chào ${patientName}, tôi là trợ lý ảo của phòng khám. Hôm nay tôi gọi để khảo sát về trải nghiệm khám bệnh gần đây của bạn.

[Bệnh nhân] Vâng, tôi nghe.

[AI] Trên thang điểm từ 1 đến 10, bạn đánh giá thế nào về dịch vụ của chúng tôi?

[Bệnh nhân] Tôi cho 8 điểm.

[AI] Cảm ơn bạn. Bạn có góp ý gì để chúng tôi cải thiện không?

[Bệnh nhân] Nhìn chung khá hài lòng, hy vọng thời gian chờ có thể ngắn hơn.

[AI] Cảm ơn ${patientName} đã dành thời gian. Chúc bạn sức khỏe!`;
}

// Run
seedData().catch(console.error);
