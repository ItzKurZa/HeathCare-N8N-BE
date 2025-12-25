import axios from 'axios';

async function testVoiceWebhook() {
    try {
        console.log('🧪 Testing voice webhook flow...\n');

        // Step 1: Tạo fake voice call record trong DB trước
        console.log('📝 Creating fake voice call record...');
        const createResponse = await axios.post('http://localhost:5000/api/voice-calls/webhook', {
            call_id: 'test_call_' + Date.now(),
            status: 'completed',
            transcript: 'Bệnh viện rất tốt, bác sĩ tận tình. Tôi rất hài lòng với dịch vụ.',
            metadata: {
                duration: 125,
                test: true
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Response from backend:', createResponse.data);
        console.log('\n🎉 Test completed!');
        console.log('👉 Check n8n to see if webhook was received');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testVoiceWebhook();
