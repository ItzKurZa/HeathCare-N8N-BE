import crypto from 'crypto';
import axios from 'axios';

const SIGNING_SECRET = 'wsec_6a8e830b68eaf1bf776d2c6e1decd3ddd6441b13bdc5f2398878689986827ca1';
// const WEBHOOK_URL = 'https://n8n.kurza.id.vn/webhook/voice-event';  // Production URL

function generateSignature(body, timestamp) {
    const payload = `${timestamp}.${body}`;
    const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
    const signature = hmac.update(payload).digest('hex');
    return `t=${timestamp},v0=${signature}`;
}

async function testRealElevenLabsFormat() {
    try {
        console.log('🧪 Testing với format ĐÚNG như ElevenLabs thực sự gửi...\n');

        // Data structure Y HỆT như ElevenLabs gửi
        const data = {
            type: 'post_call_transcription',
            event_timestamp: Math.floor(Date.now() / 1000),
            data: {
                agent_id: 'agent_0301kd7d8z2ae25rnr5ear1qxhft',
                conversation_id: 'conv_test_' + Date.now(),
                status: 'done',
                user_id: null,
                branch_id: null,
                transcript: [
                    {
                        role: 'agent',
                        message: 'Alô, dạ chào anh/chị ạ. Em là Mai, trợ lý AI Chăm Sóc Khách Hàng từ Phòng Khám Đa Khoa Healthcare. Em gọi để khảo sát sau khám bệnh.',
                        time_in_call_secs: 0
                    },
                    {
                        role: 'user',
                        message: 'Được',
                        time_in_call_secs: 5
                    },
                    {
                        role: 'agent',
                        message: 'Dạ cảm ơn anh/chị. Câu hỏi đầu tiên: Trên thang điểm từ 0 đến 10, anh/chị đánh giá mức độ hài lòng chung là bao nhiêu điểm?',
                        time_in_call_secs: 6
                    },
                    {
                        role: 'user',
                        message: '2',
                        time_in_call_secs: 15
                    },
                    {
                        role: 'agent',
                        message: 'Dạ vâng, 2 điểm. Câu hỏi thứ hai: Anh/chị đánh giá chất lượng khám chữa bệnh mấy sao từ 1 đến 5?',
                        time_in_call_secs: 16
                    },
                    {
                        role: 'user',
                        message: '1',
                        time_in_call_secs: 22
                    },
                    {
                        role: 'agent',
                        message: 'Dạ 1 sao. Câu hỏi cuối: Anh/chị có góp ý gì thêm không?',
                        time_in_call_secs: 23
                    },
                    {
                        role: 'user',
                        message: 'Bệnh viện rất tệ, bác sĩ không tận tình',
                        time_in_call_secs: 28
                    }
                ],
                metadata: {
                    start_time_unix_secs: Math.floor(Date.now() / 1000) - 64,
                    call_duration_secs: 64,
                    cost: 723
                },
                analysis: {
                    call_successful: 'success',
                    transcript_summary: 'Khách hàng KHÔNG HÀI LÒNG, đánh giá chỉ 2/10 điểm và 1/5 sao. Phàn nàn bệnh viện tệ và bác sĩ không tận tình.',
                    call_summary_title: 'Healthcare Survey - NEGATIVE FEEDBACK - Rating 2/10'
                }
            }
        };

        const bodyString = JSON.stringify(data);
        const timestamp = Math.floor(Date.now() / 1000);
        const signatureHeader = generateSignature(bodyString, timestamp);

        console.log('📦 Gửi webhook với:');
        console.log('- Type:', data.type);
        console.log('- Conversation ID:', data.data.conversation_id);
        console.log('- Duration:', data.data.metadata.call_duration_secs, 'seconds');
        console.log('- Summary:', data.data.analysis.call_summary_title);
        console.log('- User Ratings: 2/10, 1/5 (NEGATIVE!)');
        console.log('- Signature:', signatureHeader.substring(0, 50) + '...');
        console.log('- Header name: elevenlabs-signature (không có x-)\n');

        const response = await axios.post(WEBHOOK_URL, bodyString, {
            headers: {
                'Content-Type': 'application/json',
                'elevenlabs-signature': signatureHeader
            },
            timeout: 15000
        });

        console.log('✅ Thành công!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        console.log('\n🎯 Kiểm tra n8n:');
        console.log('1. Workflow đang Active (toggle xanh)?');
        console.log('2. Vào tab Executions xem workflow chạy');
        console.log('3. Click vào execution mới nhất để xem chi tiết');
        console.log('4. Kiểm tra node "Validate Signature" có pass không');

    } catch (error) {
        console.error('\n❌ Lỗi!');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit(0);
    }
}

testRealElevenLabsFormat();
