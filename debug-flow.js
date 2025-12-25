import axios from 'axios';

async function debugN8NFlow() {
    try {
        console.log('🔍 DEBUG: Testing entire flow step by step\n');

        // Data với điểm RẤT THẤP
        const testData = {
            type: 'post_call_transcription',
            event_timestamp: Math.floor(Date.now() / 1000),
            data: {
                agent_id: 'agent_0301kd7d8z2ae25rnr5ear1qxhft',
                conversation_id: 'conv_debug_' + Date.now(),
                status: 'done',
                user_id: null,
                branch_id: null,
                transcript: [
                    { role: 'agent', message: 'Đánh giá 0-10?', time_in_call_secs: 0 },
                    { role: 'user', message: '1', time_in_call_secs: 5 },
                    { role: 'agent', message: 'Đánh giá sao 1-5?', time_in_call_secs: 6 },
                    { role: 'user', message: '1', time_in_call_secs: 10 },
                ],
                metadata: {
                    start_time_unix_secs: Math.floor(Date.now() / 1000) - 30,
                    call_duration_secs: 30,
                    cost: 100
                },
                analysis: {
                    call_successful: 'success',
                    transcript_summary: 'RẤT TIÊU CỰC - 1/10 và 1/5',
                    call_summary_title: 'CRITICAL NEGATIVE FEEDBACK'
                }
            }
        };

        console.log('📊 Test data:');
        console.log('- Scores: [1, 1] (CỰC KỲ THẤP!)');
        console.log('- Conversation:', testData.data.conversation_id);
        console.log();

        // Test Calculate Sentiment logic locally
        const transcript = testData.data.transcript;
        const userMessages = transcript
            .filter(t => t.role === 'user')
            .map(t => String(t.message || '').trim());
        
        const numericScores = userMessages
            .map(msg => Number(msg))
            .filter(n => !isNaN(n) && n >= 0 && n <= 10);
        
        const isNegative = numericScores.some(score => score <= 3);
        const sentiment = isNegative ? 'negative' : 'positive';

        console.log('🧮 LOCAL CALCULATION (should match n8n):');
        console.log('- User messages:', userMessages);
        console.log('- Numeric scores:', numericScores);
        console.log('- Is negative?', isNegative);
        console.log('- Sentiment:', sentiment);
        console.log();

        if (!isNegative) {
            console.log('❌ BUG DETECTED: Logic says NOT negative but scores are', numericScores);
            console.log('   This should be NEGATIVE!');
            return;
        }

        // Test alert endpoint directly
        console.log('📧 Testing alert endpoint directly...');
        const alertPayload = {
            ...testData.data,
            evaluation: {
                userMessages,
                numericScores,
                isNegative,
                sentiment
            }
        };

        const alertResponse = await axios.post(
            'https://bennett-unvanquishable-liquidly.ngrok-free.dev/api/alerts/voice-alert',
            alertPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                timeout: 10000
            }
        );

        console.log('✅ Alert endpoint response:');
        console.log('Status:', alertResponse.status);
        console.log('Data:', JSON.stringify(alertResponse.data, null, 2));
        console.log();

        console.log('📧 Email should be sent to: nguyenthinguyen.dev@gmail.com');
        console.log('Subject: "🚨 Cảnh báo: Phản hồi tiêu cực từ khách hàng"');
        console.log();
        console.log('✅ DIRECT TEST PASSED! Email should be in inbox.');
        console.log();
        console.log('🔍 IF N8N workflow không gửi email:');
        console.log('1. Node "Is Negative?" có điều kiện SAI');
        console.log('2. Hoặc node "Send Alert" không kết nối đúng');
        console.log('3. Screenshot n8n execution cho tôi xem!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugN8NFlow();
