/**
 * Seed test data for N8N Workflow testing
 * 
 * Luồng 1: Schedule Survey Send -> Get Completed Appointments -> Filter -> Send Survey Email -> Mark Survey Sent
 * Luồng 2: Webhook Survey -> Process Survey -> Needs Improvement? -> AI Analysis / Respond Survey -> Send Alert
 * Luồng 3: Webhook Voice -> Validate Signature -> Process Voice -> Negative? -> Voice Alert
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'src/config/serviceAccountKey.json'), 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Patient data
const patients = [
  { name: 'Nguyễn Thị Nguyên', phone: '0343107931', email: 'nguyennt2.22it@vku.udn.vn' },
  { name: 'Trần Văn An', phone: '0901234567', email: 'tranvanan@gmail.com' },
  { name: 'Lê Thị Bình', phone: '0912345678', email: 'lethibinh@gmail.com' },
  { name: 'Phạm Văn Cường', phone: '0923456789', email: 'phamvancuong@gmail.com' },
  { name: 'Hoàng Thị Dung', phone: '0934567890', email: 'hoangthidung@gmail.com' },
];

const doctors = ['BS. Nguyễn Văn A', 'BS. Trần Thị B', 'BS. Lê Văn C', 'BS. Phạm Thị D'];
const departments = ['Nội khoa', 'Ngoại khoa', 'Sản khoa', 'Nhi khoa', 'Da liễu'];

function randomId() {
  return 'BK' + Math.random().toString(36).substring(2, 12).toUpperCase();
}

function randomDate(daysBack, daysForward = 0) {
  const now = new Date();
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedData() {
  console.log('🌱 Starting N8N test data seeding...\n');

  // ========================================
  // LUỒNG 1: Schedule Survey Send
  // Cần appointments đã completed nhưng chưa gửi survey
  // ========================================
  console.log('📋 LUỒNG 1: Creating completed appointments for survey sending...');
  
  const completedAppointments = [];
  for (let i = 0; i < 5; i++) {
    const patient = patients[i % patients.length];
    const appointment = {
      bookingId: randomId(),
      patientName: patient.name,
      fullName: patient.name,
      phone: patient.phone,
      email: patient.email,
      doctorName: doctors[i % doctors.length],
      department: departments[i % departments.length],
      appointmentDate: randomDate(3, 0).toISOString().split('T')[0],
      startTimeLocal: randomDate(3, 0).toISOString(),
      visitStatus: 'completed', // ĐÃ KHÁM XONG
      survey_sent: false, // CHƯA GỬI SURVEY
      survey_completed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    const docRef = await db.collection('appointments').add(appointment);
    completedAppointments.push({ id: docRef.id, ...appointment });
    console.log(`   ✅ Appointment ${appointment.bookingId} - ${patient.name} (completed, need survey)`);
  }

  // ========================================
  // LUỒNG 2: Webhook Survey -> Process
  // Cần surveys với các điểm khác nhau để test Needs Improvement
  // ========================================
  console.log('\n📝 LUỒNG 2: Creating surveys for webhook processing...');

  // Survey tốt (không cần improvement)
  const goodSurveys = [
    { nps: 9, csat: 5, facility: 5, comment: 'Dịch vụ tuyệt vời, bác sĩ rất tận tâm!' },
    { nps: 10, csat: 5, facility: 5, comment: 'Rất hài lòng với chất lượng khám bệnh' },
    { nps: 8, csat: 4, facility: 5, comment: 'Phòng khám sạch sẽ, nhân viên thân thiện' },
  ];

  // Survey cần improvement (điểm thấp)
  const badSurveys = [
    { nps: 3, csat: 2, facility: 2, comment: 'Chờ đợi quá lâu, nhân viên thái độ không tốt' },
    { nps: 4, csat: 2, facility: 3, comment: 'Bác sĩ khám qua loa, không giải thích rõ ràng' },
    { nps: 2, csat: 1, facility: 2, comment: 'Rất thất vọng, sẽ không quay lại!' },
  ];

  // Tạo good surveys
  for (let i = 0; i < goodSurveys.length; i++) {
    const patient = patients[i % patients.length];
    const survey = {
      appointmentId: randomId(),
      patientName: patient.name,
      phone: patient.phone,
      email: patient.email,
      nps: goodSurveys[i].nps,
      csat: goodSurveys[i].csat,
      facility: goodSurveys[i].facility,
      staff_doctor: 'Rất hài lòng',
      staff_reception: 'Hài lòng',
      staff_nurse: 'Hài lòng',
      waiting_time: 'Dưới 15 phút',
      comment: goodSurveys[i].comment,
      status: 'pending', // Chờ xử lý
      needsImprovement: false,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('surveys').add(survey);
    console.log(`   ✅ Good survey: ${patient.name} - NPS: ${survey.nps}/10 (${survey.comment.substring(0, 30)}...)`);
  }

  // Tạo bad surveys (needs improvement)
  for (let i = 0; i < badSurveys.length; i++) {
    const patient = patients[(i + 2) % patients.length];
    const survey = {
      appointmentId: randomId(),
      patientName: patient.name,
      phone: patient.phone,
      email: patient.email,
      nps: badSurveys[i].nps,
      csat: badSurveys[i].csat,
      facility: badSurveys[i].facility,
      staff_doctor: 'Không hài lòng',
      staff_reception: 'Không hài lòng',
      staff_nurse: 'Bình thường',
      waiting_time: 'Trên 60 phút',
      comment: badSurveys[i].comment,
      status: 'pending', // Chờ xử lý
      needsImprovement: true, // CẦN CẢI THIỆN
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('surveys').add(survey);
    console.log(`   ⚠️  Bad survey: ${patient.name} - NPS: ${survey.nps}/10 (NEEDS IMPROVEMENT)`);
  }

  // ========================================
  // LUỒNG 3: Webhook Voice -> Process Voice
  // Cần voice calls với sentiment khác nhau
  // ========================================
  console.log('\n📞 LUỒNG 3: Creating voice calls for webhook processing...');

  // Positive voice calls
  const positiveVoiceCalls = [
    { 
      transcript: 'Dạ vâng, em rất hài lòng với dịch vụ của phòng khám. Bác sĩ rất tận tâm và chu đáo. Em sẽ giới thiệu cho bạn bè.',
      sentiment: 'positive'
    },
    { 
      transcript: 'Cảm ơn phòng khám đã chăm sóc tốt cho em. Nhân viên rất thân thiện, em sẽ quay lại.',
      sentiment: 'positive'
    },
  ];

  // Negative voice calls (cần alert)
  const negativeVoiceCalls = [
    { 
      transcript: 'Tôi rất thất vọng! Phải chờ đợi 2 tiếng mà không ai thông báo. Bác sĩ khám chỉ 5 phút xong đuổi về.',
      sentiment: 'negative'
    },
    { 
      transcript: 'Nhân viên thái độ rất tệ, hỏi gì cũng trả lời cộc lốc. Tôi sẽ không bao giờ quay lại nữa!',
      sentiment: 'negative'
    },
    { 
      transcript: 'Giá quá đắt mà chất lượng không tương xứng. Cơ sở vật chất cũ kỹ, không vệ sinh.',
      sentiment: 'negative'
    },
  ];

  // Tạo positive calls
  for (let i = 0; i < positiveVoiceCalls.length; i++) {
    const patient = patients[i % patients.length];
    const voiceCall = {
      appointmentId: randomId(),
      patientName: patient.name,
      phone: patient.phone,
      callStatus: 'completed',
      transcript: positiveVoiceCalls[i].transcript,
      sentiment: positiveVoiceCalls[i].sentiment,
      duration: Math.floor(Math.random() * 180) + 60, // 1-4 phút
      aiAnalysis: {
        sentiment: 'positive',
        score: 0.85 + Math.random() * 0.15,
        keywords: ['hài lòng', 'tận tâm', 'chu đáo', 'thân thiện'],
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('voiceCalls').add(voiceCall);
    console.log(`   ✅ Positive call: ${patient.name} - "${voiceCall.transcript.substring(0, 40)}..."`);
  }

  // Tạo negative calls (sẽ trigger Voice Alert)
  for (let i = 0; i < negativeVoiceCalls.length; i++) {
    const patient = patients[(i + 2) % patients.length];
    const voiceCall = {
      appointmentId: randomId(),
      patientName: patient.name,
      phone: patient.phone,
      callStatus: 'completed',
      transcript: negativeVoiceCalls[i].transcript,
      sentiment: negativeVoiceCalls[i].sentiment,
      duration: Math.floor(Math.random() * 180) + 60,
      aiAnalysis: {
        sentiment: 'negative',
        score: 0.1 + Math.random() * 0.3,
        keywords: ['thất vọng', 'tệ', 'không bao giờ', 'đắt'],
        needsAttention: true,
      },
      needsAlert: true, // CẦN GỬI ALERT
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('voiceCalls').add(voiceCall);
    console.log(`   ⚠️  Negative call: ${patient.name} - NEEDS ALERT`);
  }

  // ========================================
  // Tạo Alerts để test dashboard
  // ========================================
  console.log('\n🚨 Creating alerts for dashboard...');

  const alertTypes = ['survey_negative', 'voice_negative', 'urgent_followup'];
  const alertMessages = [
    'Khảo sát tiêu cực từ bệnh nhân - Cần liên hệ ngay',
    'Cuộc gọi voice có phản hồi tiêu cực - Cần xử lý',
    'Bệnh nhân yêu cầu gọi lại gấp',
  ];

  for (let i = 0; i < 5; i++) {
    const patient = patients[i % patients.length];
    const alertType = alertTypes[i % alertTypes.length];
    const alert = {
      patientName: patient.name,
      phone: patient.phone,
      email: patient.email,
      type: alertType,
      message: alertMessages[i % alertMessages.length],
      priority: i < 2 ? 'high' : 'medium',
      status: i < 3 ? 'pending' : 'resolved',
      source: i % 2 === 0 ? 'survey' : 'voice',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('alerts').add(alert);
    console.log(`   🚨 Alert: ${alert.type} - ${patient.name} (${alert.priority})`);
  }

  // ========================================
  // Summary
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ N8N TEST DATA SEEDING COMPLETED!');
  console.log('='.repeat(60));
  console.log('\n📊 Summary:');
  console.log('   • 5 completed appointments (chờ gửi survey email)');
  console.log('   • 3 good surveys (NPS >= 8)');
  console.log('   • 3 bad surveys (NPS <= 4, needs improvement)');
  console.log('   • 2 positive voice calls');
  console.log('   • 3 negative voice calls (needs alert)');
  console.log('   • 5 alerts');
  console.log('\n🔗 Test N8N Workflows:');
  console.log('   1. Schedule Survey Send → Trigger để gửi survey email');
  console.log('   2. Webhook Survey → POST survey data để test processing');
  console.log('   3. Webhook Voice → POST voice data để test sentiment analysis');
  console.log('\n📧 Test patient: Nguyễn Thị Nguyên');
  console.log('   Phone: 0343107931');
  console.log('   Email: nguyennt2.22it@vku.udn.vn');

  process.exit(0);
}

seedData().catch(console.error);
