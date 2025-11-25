// Test script to create sample appointment data
import admin from 'firebase-admin';
import { config } from './src/config/env.js';

// Initialize Firebase
const serviceAccount = {
    project_id: config.firebase.projectId,
    client_email: config.firebase.clientEmail,
    private_key: config.firebase.privateKey.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.firebase.databaseURL
    });
}

const firestore = admin.firestore();

async function createTestAppointment() {
    try {
        const testAppointment = {
            bookingId: 'TEST_APPT_001',
            patientId: 'TEST_PATIENT_001',
            patientName: 'Nguyễn Văn Test',
            phone: '+84912345678', // Số test - sẽ không gọi thật
            email: 'test@example.com',
            doctorName: 'BS. Trần Thị A',
            doctor: 'BS. Trần Thị A',
            department: 'Khoa Nội Tổng Hợp',
            appointmentDate: '2025-11-25T14:00:00',
            startTimeLocal: '2025-11-25T14:00:00',
            status: 'COMPLETED',
            survey_completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await firestore.collection('appointments').add(testAppointment);
        console.log('✅ Test appointment created with ID:', docRef.id);
        console.log('📋 Appointment data:', testAppointment);
        console.log('\n🔗 Test URLs:');
        console.log('Voice Survey:');
        console.log(`http://localhost:8000/survey-selection.html?patientId=TEST_PATIENT_001&appointmentId=TEST_APPT_001`);
        console.log('\nForm Survey:');
        console.log(`http://localhost:8000/survey-form-tailwind.html?patientId=TEST_PATIENT_001&appointmentId=TEST_APPT_001`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating test appointment:', error);
        process.exit(1);
    }
}

createTestAppointment();
