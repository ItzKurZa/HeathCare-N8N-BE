import dotenv from 'dotenv';
dotenv.config();

import { firestore } from '../src/config/firebase.js';
import { createOrUpdateDoctorInCatalog } from '../src/infrastructure/services/firebase.services.js';

async function createDoctorCatalogEntry() {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  // User ID từ image
  const userId = 'ka78HIdEJrSS66AchA31lTIYlD72';
  
  console.log('🔍 Checking user...');
  const userDoc = await firestore.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    console.log('❌ User not found');
    return;
  }

  const userData = userDoc.data();
  console.log('✅ User found:');
  console.log('  - Email:', userData.email);
  console.log('  - Fullname:', userData.fullname);
  console.log('  - Role:', userData.role);
  console.log('');

  if (userData.role !== 'doctor') {
    console.log('❌ User is not a doctor');
    return;
  }

  // Kiểm tra xem đã có trong catalog chưa
  const existingSnap = await firestore
    .collection('doctors_catalog')
    .where('user_id', '==', userId)
    .get();

  if (!existingSnap.empty) {
    console.log('⚠️  Doctor already exists in catalog:');
    existingSnap.forEach(doc => {
      const data = doc.data();
      console.log(`  - ID: ${doc.id}, Doctor: ${data.doctor}, Department: ${data.department}`);
    });
    return;
  }

  // Lấy danh sách departments để user chọn
  console.log('📋 Available departments:');
  const deptSnap = await firestore.collection('departments').get();
  const departments = [];
  deptSnap.forEach(doc => {
    const data = doc.data();
    departments.push({
      id: doc.id,
      name: data.name,
      description: data.description || '',
    });
    console.log(`  ${departments.length}. ${data.name} (ID: ${doc.id})`);
  });

  if (departments.length === 0) {
    console.log('❌ No departments found. Please create a department first.');
    return;
  }

  // Sử dụng department đầu tiên làm mặc định (hoặc có thể để user chọn)
  // Ở đây tôi sẽ dùng department đầu tiên
  const selectedDept = departments[0];
  const doctorName = userData.doctor_name || userData.fullname;

  console.log('');
  console.log('📝 Creating doctor catalog entry...');
  console.log(`  - Doctor: ${doctorName}`);
  console.log(`  - Department: ${selectedDept.name} (ID: ${selectedDept.id})`);
  console.log(`  - User ID: ${userId}`);

  try {
    await createOrUpdateDoctorInCatalog({
      doctor: doctorName,
      department: selectedDept.name,
      departmentId: selectedDept.id,
      user_id: userId,
      status: 'active',
    });

    console.log('');
    console.log('✅ Successfully created doctor catalog entry!');
    
    // Cập nhật user profile với department info
    await firestore.collection('users').doc(userId).update({
      doctor_name: doctorName,
      department: selectedDept.name,
      departmentId: selectedDept.id,
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✅ Updated user profile with department info');
  } catch (error) {
    console.error('❌ Error creating doctor catalog entry:', error.message);
    throw error;
  }

  process.exit(0);
}

createDoctorCatalogEntry().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
