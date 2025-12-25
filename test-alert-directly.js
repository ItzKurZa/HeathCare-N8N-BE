import axios from 'axios';

async function testAlertDirectly() {
    try {
        console.log('🚨 Testing alert endpoint directly...\n');

        const alertData = {
            conversationId: 'test_conv_direct',
            agentId: 'agent_4801kany60txemet20th12zqtw2v',
            sentiment: 'negative',
            patientName: 'Test Patient',
            appointmentId: 'test_apt_123',
            transcript: [
                { role: 'agent', message: 'Câu hỏi: Đánh giá từ 0-10?' },
                { role: 'user', message: '2' },
                { role: 'agent', message: 'Đánh giá sao từ 1-5?' },
                { role: 'user', message: '1' }
            ],
            analysis: {
                transcript_summary: 'Khách hàng không hài lòng, chỉ cho 2/10 điểm và 1/5 sao',
                call_summary_title: 'Negative Feedback - Rating 2/10'
            },
            evaluation: {
                isNegative: true,
                sentiment: 'negative',
                numericScores: [2, 1]
            }
        };

        console.log('📦 Sending alert data:');
        console.log('- Conversation:', alertData.conversationId);
        console.log('- Sentiment:', alertData.sentiment);
        console.log('- Patient:', alertData.patientName);
        console.log('- Scores:', alertData.evaluation.numericScores, '\n');

        const response = await axios.post(
            'https://bennett-unvanquishable-liquidly.ngrok-free.dev/api/alerts/voice-alert',
            alertData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                timeout: 15000
            }
        );

        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        console.log('\n📧 Check email at: nguyenthinguyen.dev@gmail.com');
        console.log('Subject: "🚨 Cảnh báo: Phản hồi tiêu cực từ khách hàng"');

    } catch (error) {
        console.error('\n❌ Error!');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit(0);
    }
}

testAlertDirectly();
