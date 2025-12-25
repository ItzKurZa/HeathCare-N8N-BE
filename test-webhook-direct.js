import axios from 'axios';
import { firestore } from './src/config/firebase.js';

async function testDirectWebhook() {
    try {
        console.log('🧪 Testing direct webhook to n8n...\n');

        // Tạo một voice call record giả trong Firestore
        console.log('📝 Creating test voice call record in Firestore...');
        const testCallId = 'test_direct_' + Date.now();
        
        const voiceCallRef = await firestore.collection('voice_calls').add({
            appointmentId: 'test_appointment_123',
            patientName: 'Nguyễn Test',
            phone: '+84123456789',
            callStatus: 'INITIATED',
            elevenlabsCallId: testCallId,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        console.log('✅ Voice call record created:', voiceCallRef.id);

        // Simulate webhook từ ElevenLabs
        console.log('\n🔔 Sending webhook to backend...');
        const webhookResponse = await axios.post(
            'http://localhost:5000/api/voice-calls/webhook',
            {
                call_id: testCallId,
                status: 'completed',
                transcript: 'Bệnh viện quá tệ, tôi rất không hài lòng. Bác sĩ không tận tình, phải chờ lâu. Dịch vụ kém, tôi đánh giá 1 sao.',
                metadata: {
                    duration: 180,
                    language: 'vi',
                    rating: 1
                }
            },
            { 
                headers: { 
                    'Content-Type': 'application/json'
                } 
            }
        );

        console.log('✅ Webhook response:', webhookResponse.data);
        console.log('\n🎉 Test completed!');
        console.log('👉 Check n8n to see if it received the webhook');
        console.log('👉 Expected URL: https://n8n.kurza.id.vn/webhook-test/voice-event');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit(0);
    }
}

testDirectWebhook();
