/**
 * Script để tạo tài khoản admin đầu tiên
 * 
 * Cách sử dụng:
 * 1. Tạo user bình thường qua API signup hoặc Firebase Console
 * 2. Chạy script này với email của user đó:
 *    npm run create-admin <email>
 *    hoặc
 *    node scripts/create-admin.js <email>
 * 
 * Hoặc set trực tiếp trong Firestore:
 * - Vào Firestore Console
 * - Tìm collection "users"
 * - Tìm document của user cần set admin
 * - Thêm/sửa field "role" = "admin"
 */

import dotenv from 'dotenv';
dotenv.config();

import { firebaseAdmin, firestore } from '../src/config/firebase.js';
import { updateUserRole } from '../src/infrastructure/services/firebase.services.js';

const email = process.argv[2];

if (!email) {
  console.error('❌ Vui lòng cung cấp email của user cần set làm admin');
  console.log('\nCách sử dụng:');
  console.log('  node scripts/create-admin.js <email>');
  console.log('\nVí dụ:');
  console.log('  node scripts/create-admin.js admin@example.com');
  process.exit(1);
}

async function createAdmin() {
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
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Đã tạo profile và set role = admin');
    } else {
      // Update role
      console.log('📝 Đang update role thành admin...');
      await updateUserRole(userRecord.uid, 'admin');
      console.log('✅ Đã set role = admin thành công!');
    }

    // Verify
    const updatedDoc = await firestore.collection('users').doc(userRecord.uid).get();
    const userData = updatedDoc.data();
    console.log('\n📋 Thông tin user sau khi update:');
    console.log(`   Email: ${userData.email}`);
    console.log(`   Fullname: ${userData.fullname || 'N/A'}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   UID: ${userRecord.uid}`);
    
    console.log('\n✅ Hoàn thành! User này giờ đã có quyền admin.');
    console.log('\n💡 Bạn có thể đăng nhập với email này và sẽ thấy menu Admin.');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

createAdmin();
