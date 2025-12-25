import axios from 'axios';

async function testAlertEmail() {
  try {
    console.log('📧 Testing alert email endpoint directly...\n');

    const payload = {
      patientName: 'Test Patient',
      phone: '+84343107931',
      appointmentId: 'test_appointment_123',
      conversationId: 'conv_test_negative_123',
      sentiment: 'NEGATIVE',
      transcript: 'User: 1\nUser: 1\nUser: 2',
      surveyData: {
        userAnswers: ['1', '1', '2'],
        numericScores: [1, 1, 2]
      },
      analysis: {
        call_successful: 'success',
        transcript_summary: 'Khách hàng rất không hài lòng với dịch vụ, đánh giá 1/10 và 1/5 sao.'
      }
    };

    const response = await axios.post(
      'http://localhost:5000/api/alerts/send',
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Thành công!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    console.log('\n📧 Kiểm tra:');
    console.log('1. Backend logs có "📧 Sending alert for: Test Patient"');
    console.log('2. Email inbox: nguyenthinguyen.dev@gmail.com');
    console.log('3. Spam folder nếu không thấy trong inbox');

  } catch (err) {
    console.error('\n❌ FAILED');
    console.error('Message:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

testAlertEmail();
