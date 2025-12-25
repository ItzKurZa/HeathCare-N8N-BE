const axios = require('axios');

// Cấu hình
const BACKEND_URL = 'http://localhost:5000';
const N8N_WEBHOOK_URL = 'https://YOUR_NGROK_URL/webhook/survey-webhook';

// Test data - Khảo sát tích cực
const positiveTestData = {
  booking_id: 'TEST_POSITIVE_001',
  patient_name: 'Trần Văn B',
  phone: '0912345678',
  email: 'tranvanb@test.com',
  nps: 9,
  csat: 5,
  facility: 5,
  staff_attitude: {
    doctor_label: 'Rất tốt',
    reception_label: 'Rất tốt',
    nurse_label: 'Tốt'
  },
  waiting_time: '20 phút',
  comment: 'Rất hài lòng với dịch vụ',
  doctor_name: 'Bác sĩ Nguyễn Văn A'
};

// Test data - Khảo sát tiêu cực (trigger alert)
const negativeTestData = {
  booking_id: 'TEST_NEGATIVE_002',
  patient_name: 'Lê Thị C',
  phone: '0923456789',
  email: 'lethic@test.com',
  nps: 4,
  csat: 2,
  facility: 2,
  staff_attitude: {
    doctor_label: 'Trung bình',
    reception_label: 'Kém',
    nurse_label: 'Trung bình'
  },
  waiting_time: '90 phút',
  comment: 'Chờ đợi quá lâu, nhân viên tiếp tân không nhiệt tình',
  doctor_name: 'Bác sĩ Trần Văn B'
};

// Test data - Khảo sát không có comment
const neutralTestData = {
  booking_id: 'TEST_NEUTRAL_003',
  patient_name: 'Phạm Văn D',
  phone: '0934567890',
  email: 'phamvand@test.com',
  nps: 7,
  csat: 3,
  facility: 4,
  staff_attitude: {
    doctor_label: 'Tốt',
    reception_label: 'Tốt',
    nurse_label: 'Tốt'
  },
  waiting_time: '45 phút',
  comment: '',
  doctor_name: 'Bác sĩ Lê Văn C'
};

// Function test gửi survey qua Backend API
async function testBackendAPI(testData, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing: ${testName}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    console.log('📤 Sending request to Backend API...');
    console.log('URL:', `${BACKEND_URL}/api/surveys/submit`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(
      `${BACKEND_URL}/api/surveys/submit`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Backend Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Backend Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
    return { success: false, error: error.message };
  }
}

// Function test gửi trực tiếp đến N8N webhook
async function testN8NWebhook(testData, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔗 Testing N8N Webhook: ${testName}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    console.log('📤 Sending request directly to N8N webhook...');
    console.log('URL:', N8N_WEBHOOK_URL);
    
    // Transform data to match N8N expected format
    const n8nPayload = {
      surveyId: `DIRECT_TEST_${Date.now()}`,
      ...testData,
      submittedAt: new Date().toISOString(),
      overall_score: calculateOverallScore(testData),
      needsImprovement: checkNeedsImprovement(testData)
    };
    
    console.log('Data:', JSON.stringify(n8nPayload, null, 2));
    
    const response = await axios.post(
      N8N_WEBHOOK_URL,
      n8nPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ N8N Webhook Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ N8N Webhook Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
    return { success: false, error: error.message };
  }
}

// Helper function: Calculate overall score
function calculateOverallScore(data) {
  const npsScore = data.nps || 0;
  const csatScore = (data.csat || 0) * 2;
  const facilityScore = (data.facility || 0) * 2;
  const scores = [npsScore, csatScore, facilityScore].filter(s => s > 0);
  return scores.length > 0 
    ? scores.reduce((a, b) => a + b) / scores.length 
    : 0;
}

// Helper function: Check if improvement needed
function checkNeedsImprovement(data) {
  const overallScore = calculateOverallScore(data);
  return overallScore < 7 || 
         data.nps < 7 || 
         (data.comment && data.comment.length > 0);
}

// Test Backend Health
async function testBackendHealth() {
  console.log('\n🏥 Testing Backend Health...');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend is healthy:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Backend is not accessible:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🚀 Starting Survey Tests...');
  console.log('Backend URL:', BACKEND_URL);
  console.log('N8N Webhook:', N8N_WEBHOOK_URL);
  console.log('\n');
  
  // Test backend health
  const isHealthy = await testBackendHealth();
  if (!isHealthy) {
    console.error('\n❌ Backend is not running. Please start backend first:');
    console.error('cd c:\\Nam4_Ky1\\HeathCare-N8N-BE && npm start');
    return;
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 1: Positive survey (no alert)
  await testBackendAPI(positiveTestData, 'Positive Survey (No Alert)');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Negative survey (trigger alert)
  await testBackendAPI(negativeTestData, 'Negative Survey (Trigger Alert)');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Neutral survey
  await testBackendAPI(neutralTestData, 'Neutral Survey');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test direct N8N webhook (if configured)
  if (N8N_WEBHOOK_URL && !N8N_WEBHOOK_URL.includes('YOUR_NGROK_URL')) {
    console.log('\n\n🔗 Testing Direct N8N Webhook...');
    await testN8NWebhook(positiveTestData, 'Direct N8N Test');
  } else {
    console.log('\n\n⚠️  N8N_WEBHOOK_URL not configured. Skipping direct webhook test.');
    console.log('Update N8N_WEBHOOK_URL in this script to test direct webhook.');
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
  console.log('\n📋 Next steps:');
  console.log('1. Check Backend logs for processing details');
  console.log('2. Open N8N (http://localhost:5678) and check Executions');
  console.log('3. Check Firebase Console for new survey records');
  console.log('4. Check if alert emails were sent (for negative surveys)');
  console.log('\n');
}

// Run tests
runTests().catch(console.error);
