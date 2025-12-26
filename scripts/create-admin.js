/**
 * Script để tạo tài khoản admin
 * 
 * Cách sử dụng:
 * 
 * Option 1: Tạo admin mới (tự động generate password)
 *   node scripts/create-admin.js --create <email> [fullname]
 * 
 * Option 2: Set role admin cho user đã tồn tại
 *   node scripts/create-admin.js <email>
 * 
 * Ví dụ:
 *   node scripts/create-admin.js --create admin@example.com "Admin User"
 *   node scripts/create-admin.js admin@example.com
 */

import dotenv from 'dotenv';
dotenv.config();

import { firebaseAdmin, firestore } from '../src/config/firebase.js';
import { updateUserRole } from '../src/infrastructure/services/firebase.services.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Helper để generate password
function generatePassword() {
  // Generate random password 16 chars với đủ loại ký tự
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Đảm bảo có ít nhất 1 ký tự mỗi loại
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  // Thêm các ký tự ngẫu nhiên
  for (let i = password.length; i < 16; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const args = process.argv.slice(2);
const isCreateMode = args[0] === '--create';
const email = isCreateMode ? args[1] : args[0];
const fullname = isCreateMode ? args[2] : undefined;

if (!email) {
  console.error('❌ Vui lòng cung cấp email');
  console.log('\nCách sử dụng:');
  console.log('  Tạo admin mới:');
  console.log('    node scripts/create-admin.js --create <email> [fullname]');
  console.log('  Set role cho user đã tồn tại:');
  console.log('    node scripts/create-admin.js <email>');
  console.log('\nVí dụ:');
  console.log('  node scripts/create-admin.js --create admin@example.com "Admin User"');
  console.log('  node scripts/create-admin.js admin@example.com');
  process.exit(1);
}

async function createAdmin() {
  try {
    if (!firestore) {
      console.error('❌ Firestore chưa được khởi tạo');
      process.exit(1);
    }

    if (!firebaseAdmin || !firebaseAdmin.auth) {
      console.error('❌ Firebase Admin chưa được khởi tạo');
      process.exit(1);
    }

    let userRecord;
    let password = null;
    let shouldCreateNew = isCreateMode;

    if (isCreateMode) {
      // Tạo admin mới
      console.log(`🚀 Tạo tài khoản admin mới...`);
      console.log(`   Email: ${email}`);
      if (fullname) console.log(`   Fullname: ${fullname}`);

      // Generate password
      password = generatePassword();
      console.log(`   Password: ${password}`);

      // Kiểm tra email đã tồn tại chưa
      try {
        userRecord = await firebaseAdmin.auth().getUserByEmail(email);
        console.log(`\n⚠️  Email đã tồn tại trong Firebase Auth: ${userRecord.uid}`);
        console.log('   Chuyển sang chế độ set role cho user đã tồn tại...\n');
        shouldCreateNew = false; // Switch to update mode
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          // Email chưa tồn tại, tạo mới
          console.log('\n📝 Đang tạo user trong Firebase Auth...');
          
          userRecord = await firebaseAdmin.auth().createUser({
            email: email,
            password: password,
            displayName: fullname || 'Admin User',
            emailVerified: false,
          });

          console.log(`✅ Đã tạo user trong Firebase Auth: ${userRecord.uid}`);

          // Tạo profile trong Firestore
          const userData = {
            uid: userRecord.uid,
            email: email,
            fullname: fullname || 'Admin User',
            phone: '',
            cccd: '',
            role: 'admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await firestore.collection('users').doc(userRecord.uid).set(userData, { merge: true });
          console.log('✅ Đã tạo profile trong Firestore với role = admin');

          // Lưu credentials vào file
          const credentialsFile = join(process.cwd(), 'admin-credentials.json');
          const credentialsData = {
            generatedAt: new Date().toISOString(),
            email: email,
            password: password,
            uid: userRecord.uid,
            fullname: fullname || 'Admin User',
            role: 'admin',
          };

          writeFileSync(credentialsFile, JSON.stringify(credentialsData, null, 2), 'utf8');

          console.log('\n✨ Tạo admin thành công!');
          console.log('\n📋 Thông tin đăng nhập:');
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
          console.log(`   UID: ${userRecord.uid}`);
          console.log(`   Role: admin`);
          console.log(`\n📄 Credentials đã được lưu vào: ${credentialsFile}`);
          console.log('\n⚠️  QUAN TRỌNG: Lưu lại password này! User nên đổi password sau lần đăng nhập đầu tiên.');
          
          process.exit(0);
        } else {
          throw err;
        }
      }
    }

    // Set role cho user đã tồn tại
    if (!shouldCreateNew) {
      console.log(`🔍 Đang tìm user với email: ${email}...`);

      try {
        userRecord = await firebaseAdmin.auth().getUserByEmail(email);
        console.log(`✅ Tìm thấy user trong Firebase Auth: ${userRecord.uid}`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          console.error('❌ Không tìm thấy user trong Firebase Auth');
          console.log('\n💡 Sử dụng --create để tạo admin mới:');
          console.log(`   node scripts/create-admin.js --create ${email} [fullname]`);
          process.exit(1);
        } else {
          throw err;
        }
      }

      const userDoc = await firestore.collection('users').doc(userRecord.uid).get();
      
      if (!userDoc.exists) {
        console.log('⚠️  User chưa có trong Firestore, đang tạo profile...');
        await firestore.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: userRecord.email,
          fullname: userRecord.displayName || '',
          phone: userRecord.phoneNumber || '',
          cccd: '',
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log('✅ Đã tạo profile và set role = admin');
      } else {
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
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

createAdmin();
