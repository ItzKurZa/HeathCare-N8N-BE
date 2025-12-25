/**
 * Script để test Workflow 1: Survey Scheduling
 * Tạo dữ liệu appointment giả đã hoàn thành để trigger gửi survey
 */

import admin from 'firebase-admin';
import { config } from './src/config/env.js';

// Khởi tạo Firebase
if (!admin.apps.length) {
    // Sử dụng từng field riêng lẻ thay vì JSON
    const serviceAccount = {
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey?.replace(/\\n/g, '\n'),
    };
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.firebase.databaseURL
    });
}

const db = admin.firestore();

// Dữ liệu giả cho appointments đã hoàn thành
const fakeCompletedAppointments = [
    {
        appointmentId: 'APT-' + Date.now() + '-001',
        patientId: 'PAT-001',
        patientName: 'Nguyễn Văn A',
        patientEmail: 'nguyenvana@example.com',
        patientPhone: '+84123456789',
        doctorName: 'BS. Trần Thị B',
        department: 'Khoa Nội',
        appointmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 ngày trước
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'completed',
        needsSurvey: true,
        surveyStatus: 'pending',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
        appointmentId: 'APT-' + Date.now() + '-002',
        patientId: 'PAT-002',
        patientName: 'Trần Thị C',
        patientEmail: 'tranthic@example.com',
        patientPhone: '+84987654321',
        doctorName: 'BS. Lê Văn D',
        department: 'Khoa Ngoại',
        appointmentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 ngày trước
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'completed',
        needsSurvey: true,
        surveyStatus: 'pending',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
        appointmentId: 'APT-' + Date.now() + '-003',
        patientId: 'PAT-003',
        patientName: 'Phạm Văn E',
        patientEmail: 'phamvane@example.com',
        patientPhone: '+84912345678',
        doctorName: 'BS. Hoàng Thị F',
        department: 'Khoa Tim Mạch',
        appointmentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 ngày trước
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'completed',
        needsSurvey: true,
        surveyStatus: 'pending',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    }
];

// Hàm seed dữ liệu vào Firestore
async function seedCompletedAppointments() {
    try {
        console.log('🚀 Bắt đầu seed dữ liệu appointments...\n');

        for (const appointment of fakeCompletedAppointments) {
            const docRef = db.collection('appointments').doc(appointment.appointmentId);
            await docRef.set(appointment);
            
            console.log(`✅ Đã tạo appointment: ${appointment.appointmentId}`);
            console.log(`   - Bệnh nhân: ${appointment.patientName}`);
            console.log(`   - Email: ${appointment.patientEmail}`);
            console.log(`   - Bác sĩ: ${appointment.doctorName}`);
            console.log(`   - Ngày khám: ${appointment.appointmentDate.toLocaleDateString('vi-VN')}`);
            console.log(`   - Trạng thái: ${appointment.status}`);
            console.log(`   - Cần survey: ${appointment.needsSurvey ? 'Có' : 'Không'}\n`);
        }

        console.log('✨ HOÀN THÀNH! Đã tạo ' + fakeCompletedAppointments.length + ' appointments.');
        console.log('\n📊 Thống kê:');
        console.log('   - Tổng appointments: ' + fakeCompletedAppointments.length);
        console.log('   - Cần gửi survey: ' + fakeCompletedAppointments.filter(a => a.needsSurvey).length);
        console.log('   - Trạng thái pending: ' + fakeCompletedAppointments.filter(a => a.surveyStatus === 'pending').length);

        console.log('\n🔔 Tiếp theo:');
        console.log('   1. Vào n8n workflow "Survey Scheduling"');
        console.log('   2. Click "Execute Workflow" để chạy thủ công');
        console.log('   3. Hoặc đợi schedule trigger tự động chạy');
        console.log('   4. Kiểm tra email được gửi đi');

    } catch (error) {
        console.error('❌ Lỗi khi seed dữ liệu:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// Test API endpoint trực tiếp
async function testGetCompletedAppointmentsAPI() {
    try {
        console.log('\n🧪 Test API: GET /api/appointments/completed\n');
        
        const response = await fetch('https://kurza.id.vn/api/appointments/completed', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        
        console.log('📡 Response Status:', response.status);
        console.log('📦 Response Data:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log(`\n✅ API hoạt động! Tìm thấy ${data.data?.length || 0} appointments cần gửi survey.`);
        } else {
            console.log('\n❌ API lỗi:', data.error || data.message);
        }

    } catch (error) {
        console.error('❌ Lỗi khi test API:', error.message);
    }
}

// Test gửi survey email trực tiếp
async function testSendSurveyEmail() {
    const testData = {
        appointmentId: 'APT-' + Date.now() + '-TEST',
        patientName: 'Nguyễn Test',
        patientEmail: 'test@example.com', // Thay bằng email thật để test
        doctorName: 'BS. Test',
        department: 'Khoa Test',
        appointmentDate: new Date().toISOString(),
        surveyUrl: 'https://kurza.id.vn/survey?id=TEST123'
    };

    try {
        console.log('\n📧 Test gửi survey email...\n');
        console.log('📨 Dữ liệu gửi:', JSON.stringify(testData, null, 2));

        const response = await fetch('https://kurza.id.vn/api/survey/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();
        
        console.log('\n📡 Response Status:', response.status);
        console.log('📦 Response Data:', JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log('\n✅ Email đã được gửi thành công!');
        } else {
            console.log('\n❌ Gửi email thất bại:', result.error || result.message);
        }

    } catch (error) {
        console.error('❌ Lỗi khi test gửi email:', error.message);
    }
}

// Menu lựa chọn
const args = process.argv.slice(2);
const command = args[0];

console.log('═══════════════════════════════════════════════════');
console.log('  🧪 TEST WORKFLOW 1: SURVEY SCHEDULING');
console.log('═══════════════════════════════════════════════════\n');

switch (command) {
    case 'seed':
        console.log('📝 Chế độ: Seed dữ liệu appointments giả\n');
        seedCompletedAppointments();
        break;
    
    case 'test-api':
        console.log('🧪 Chế độ: Test API Get Completed Appointments\n');
        testGetCompletedAppointmentsAPI();
        break;
    
    case 'test-email':
        console.log('📧 Chế độ: Test gửi survey email\n');
        testSendSurveyEmail();
        break;
    
    case 'all':
        console.log('🎯 Chế độ: Chạy tất cả tests\n');
        (async () => {
            await seedCompletedAppointments();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await testGetCompletedAppointmentsAPI();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await testSendSurveyEmail();
            process.exit(0);
        })();
        break;
    
    default:
        console.log('📋 Cách sử dụng:');
        console.log('   node test-survey-workflow.js seed        - Tạo dữ liệu giả');
        console.log('   node test-survey-workflow.js test-api    - Test API get appointments');
        console.log('   node test-survey-workflow.js test-email  - Test gửi email');
        console.log('   node test-survey-workflow.js all         - Chạy tất cả\n');
        process.exit(0);
}
