import axios from 'axios';

async function testN8NDirectly() {
    try {
        console.log('🧪 Testing n8n webhook directly...\n');

        const n8nUrl = 'https://n8n.kurza.id.vn/webhook/voice-event';
        console.log(`📡 Sending to: ${n8nUrl}\n`);

        const testData = {
            call_id: 'test_direct_n8n_' + Date.now(),
            appointment_id: 'test_appointment_456',
            patient_name: 'Test Patient',
            phone: '+84987654321',
            status: 'completed',
            transcript: 'Bệnh viện quá tệ, không hài lòng, đánh giá 1 sao',
            sentiment: 'NEGATIVE',
            completed_at: new Date().toISOString()
        };

        console.log('📦 Data:', JSON.stringify(testData, null, 2));
        console.log('\n⏳ Sending...\n');

        const response = await axios.post(n8nUrl, testData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('Response:', response.data);

    } catch (error) {
        console.error('\n❌ Failed!');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        if (error.code) {
            console.error('Code:', error.code);
        }
    } finally {
        process.exit(0);
    }
}

testN8NDirectly();
