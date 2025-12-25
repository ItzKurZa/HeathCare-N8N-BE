import axios from 'axios';

async function setupAndTestVoiceFlow() {
    try {
        console.log('🎬 Setting up test data and testing voice flow...\n');

        // Step 1: Tạo fake appointment trong Firestore
        console.log('📋 Step 1: Create test appointment...');
        // Giả sử đã có appointment với ID: q4ovzcHNTgYCLRM5on9E

        const appointmentId = 'q4ovzcHNTgYCLRM5on9E'; // Appointment có sẵn

        // Step 2: Initiate voice call
        console.log('📞 Step 2: Initiating voice call...');
        const initiateResponse = await axios.post(
            `http://localhost:5000/api/voice-calls/initiate/${appointmentId}`,
            {},
            { headers: { 'Content-Type': 'application/json' } }
        );

        console.log('✅ Voice call initiated:', initiateResponse.data);
        const callId = initiateResponse.data.data.callId;

        console.log(`\n⏳ Waiting 2 seconds before sending webhook...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Simulate ElevenLabs webhook callback
        console.log('🔔 Step 3: Simulating ElevenLabs webhook...');
        const webhookResponse = await axios.post(
            'http://localhost:5000/api/voice-calls/webhook',
            {
                call_id: callId,
                status: 'completed',
                transcript: 'Xin chào, cảm ơn bác sĩ đã tư vấn cho tôi. Dịch vụ rất tốt, bác sĩ nhiệt tình. Tôi rất hài lòng.',
                metadata: {
                    duration: 180,
                    language: 'vi'
                }
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        console.log('✅ Webhook processed:', webhookResponse.data);

        console.log('\n🎉 Test completed successfully!');
        console.log('👉 Check n8n webhook listener to see if data was received');
        console.log('👉 Expected data: call_id, appointment_id, transcript, sentiment, etc.');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

setupAndTestVoiceFlow();
