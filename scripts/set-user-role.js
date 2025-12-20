/**
 * Script để set role cho user (admin, doctor, hoặc patient)
 * 
 * Cách sử dụng:
 * 1. Tạo user bình thường qua API signup hoặc Firebase Console
 * 2. Chạy script này với email và role:
 *    npm run set-role <email> <role>
 *    hoặc
 *    node scripts/set-user-role.js <email> <role>
 * 
 * Ví dụ:
 *    npm run set-role doctor@example.com doctor
 *    npm run set-role admin@example.com admin
 */

import dotenv from 'dotenv';
dotenv.config();

import { firebaseAdmin, firestore } from '../src/config/firebase.js';
import { updateUserRole } from '../src/infrastructure/services/firebase.services.js';

const email = process.argv[2];
const role = process.argv[3];
const doctorName = process.argv[4]; // Optional: tên bác sĩ
const department = process.argv[5]; // Optional: khoa

const validRoles = ['patient', 'doctor', 'admin'];

if (!email || !role) {
  console.error('❌ Vui lòng cung cấp email và role');
  console.log('\nCách sử dụng:');
  console.log('  npm run set-role <email> <role> [doctor_name] [department]');
  console.log('  hoặc');
  console.log('  node scripts/set-user-role.js <email> <role> [doctor_name] [department]');
  console.log('\nVí dụ:');
  console.log('  npm run set-role doctor@example.com doctor');
  console.log('  npm run set-role doctor@example.com doctor "Bác sĩ Nguyễn Văn A" "Khoa Nội"');
  console.log('  npm run set-role admin@example.com admin');
  console.log('\nCác role hợp lệ:', validRoles.join(', '));
  console.log('\nLưu ý: Nếu set role doctor, có thể thêm doctor_name và department để giới hạn quyền truy cập');
  process.exit(1);
}

if (!validRoles.includes(role)) {
  console.error(`❌ Role không hợp lệ: "${role}"`);
  console.log(`\nCác role hợp lệ: ${validRoles.join(', ')}`);
  process.exit(1);
}

if (role === 'doctor' && (!doctorName || !department)) {
  console.warn('⚠️  Cảnh báo: Bạn đang set role doctor mà không có doctor_name và department.');
  console.warn('   Doctor sẽ không thể xem/cập nhật bookings nếu thiếu thông tin này.');
  console.warn('   Khuyến nghị: npm run set-role <email> doctor "<doctor_name>" "<department>"');
}

async function setUserRole() {
  try {
    console.log(`🔍 Đang tìm user với email: ${email}...`);

    // Tìm user trong Firebase Auth
    let userRecord;
    try {
      userRecord = await firebaseAdmin.auth().getUserByEmail(email);
      console.log(`✅ Tìm thấy user trong Firebase Auth: ${userRecord.uid}`);
    } catch (err) {
      console.error('❌ Không tìm thấy user trong Firebase Auth:', err.message);
      console.log('\n💡 Hãy đảm bảo user đã được tạo qua API signup hoặc Firebase Console');
      process.exit(1);
    }

    // Kiểm tra user trong Firestore
    if (!firestore) {
      console.error('❌ Firestore chưa được khởi tạo');
      process.exit(1);
    }

    const userDoc = await firestore.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      console.log('⚠️  User chưa có trong Firestore, đang tạo profile...');
      // Tạo profile nếu chưa có
      await firestore.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: userRecord.email,
        fullname: userRecord.displayName || '',
        phone: userRecord.phoneNumber || '',
        cccd: '',
        role: role,
        createdAt: new Date().toISOString(),
      });
      console.log(`✅ Đã tạo profile và set role = ${role}`);
    } else {
      // Update role
      const currentRole = userDoc.data().role || 'patient';
      console.log(`📝 Đang update role từ "${currentRole}" thành "${role}"...`);
      
      const options = {};
      if (role === 'doctor') {
        if (doctorName) {
          options.doctor_name = doctorName;
          console.log(`   - Doctor name: ${doctorName}`);
        }
        if (department) {
          options.department = department;
          console.log(`   - Department: ${department}`);
        }
      }
      
      await updateUserRole(userRecord.uid, role, options);
      console.log(`✅ Đã set role = ${role} thành công!`);
    }

    // Verify
    const updatedDoc = await firestore.collection('users').doc(userRecord.uid).get();
    const userData = updatedDoc.data();
    console.log('\n📋 Thông tin user sau khi update:');
    console.log(`   Email: ${userData.email}`);
    console.log(`   Fullname: ${userData.fullname || 'N/A'}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   UID: ${userRecord.uid}`);
    
    console.log(`\n✅ Hoàn thành! User này giờ đã có quyền ${role}.`);
    
    if (role === 'admin') {
      console.log('\n💡 Admin có thể:');
      console.log('   - Xem thống kê và quản lý bệnh nhân');
      console.log('   - Set role cho user khác');
    } else if (role === 'doctor') {
      console.log('\n💡 Doctor có thể:');
      console.log('   - Xem lịch hẹn của mình');
      console.log('   - Quản lý schedule');
      console.log('   - Cập nhật trạng thái booking');
    } else {
      console.log('\n💡 Patient có thể:');
      console.log('   - Đặt lịch hẹn');
      console.log('   - Upload hồ sơ y tế');
      console.log('   - Xem profile và lịch sử khám');
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

setUserRole();
