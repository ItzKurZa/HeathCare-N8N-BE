/**
 * Script: Tạo users cho các doctors trong doctors_catalog chưa có user_id
 * 
 * Logic:
 * 1. Lấy tất cả doctors_catalog records
 * 2. Kiểm tra xem có user_id chưa
 * 3. Nếu chưa có, tạo user mới với role='doctor'
 * 4. Update doctors_catalog với user_id mới
 * 
 * Usage:
 *   node scripts/create-users-for-doctors.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { firestore, firebaseAdmin } from '../src/config/firebase.js';
import { v4 as uuid } from 'uuid';

// Helper để generate email từ doctor name
function generateEmail(doctorName) {
  if (!doctorName) return null;
  
  // Normalize: bỏ dấu, lowercase, thay space bằng dot
  const normalized = doctorName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '.');
  
  return `${normalized}@doctor.local`;
}

// Helper để generate password
function generatePassword() {
  // Generate random password 12 chars
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createUsersForDoctors() {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized. Please check your Firebase credentials.');
    }

    if (!firebaseAdmin || !firebaseAdmin.auth) {
      throw new Error('Firebase Admin not initialized.');
    }

    console.log('🚀 Starting: Create users for doctors without user_id...\n');

    // Step 1: Lấy tất cả doctors_catalog
    const catalogSnap = await firestore.collection('doctors_catalog').get();
    console.log(`📋 Found ${catalogSnap.size} doctors in catalog\n`);

    if (catalogSnap.empty) {
      console.log('⚠️  No doctors found. Script skipped.');
      return;
    }

    // Step 2: Lấy tất cả users với role='doctor' để check duplicate
    const usersSnap = await firestore
      .collection('users')
      .where('role', '==', 'doctor')
      .get();

    const existingDoctorEmails = new Set();
    const existingDoctorNames = new Map(); // doctor_name + department -> userId

    usersSnap.forEach((doc) => {
      const user = doc.data();
      if (user.email) existingDoctorEmails.add(user.email.toLowerCase());
      if (user.doctor_name && user.department) {
        const key = `${user.doctor_name}|${user.department}`;
        existingDoctorNames.set(key, doc.id);
      }
    });

    console.log(`👤 Found ${usersSnap.size} existing doctor users\n`);

    // Step 3: Tìm doctors chưa có user_id
    const doctorsNeedingUsers = [];
    let alreadyHasUser = 0;
    let duplicateFound = 0;

    catalogSnap.forEach((doc) => {
      const data = doc.data();
      const doctorName = (data.doctor || '').trim();
      const department = (data.department || '').trim();
      const userId = data.user_id;

      if (!doctorName || !department) {
        return; // Skip invalid records
      }

      if (userId) {
        // Check xem user có tồn tại không
        const userRef = firestore.collection('users').doc(userId);
        userRef.get().then((userDoc) => {
          if (!userDoc.exists) {
            console.log(`⚠️  Doctor "${doctorName}" has user_id ${userId} but user doesn't exist`);
          }
        });
        alreadyHasUser++;
        return;
      }

      // Check xem đã có user với doctor_name + department này chưa
      const key = `${doctorName}|${department}`;
      const existingUserId = existingDoctorNames.get(key);
      if (existingUserId) {
        // Đã có user, chỉ cần update doctors_catalog
        doctorsNeedingUsers.push({
          catalogDoc: doc,
          doctorName,
          department,
          departmentId: data.departmentId,
          action: 'link', // Link to existing user
          existingUserId,
        });
        duplicateFound++;
      } else {
        // Chưa có user, cần tạo mới
        doctorsNeedingUsers.push({
          catalogDoc: doc,
          doctorName,
          department,
          departmentId: data.departmentId,
          action: 'create', // Create new user
        });
      }
    });

    console.log(`📊 Analysis:`);
    console.log(`  - Already have user_id: ${alreadyHasUser}`);
    console.log(`  - Need to link existing user: ${duplicateFound}`);
    console.log(`  - Need to create new user: ${doctorsNeedingUsers.length - duplicateFound}\n`);

    if (doctorsNeedingUsers.length === 0) {
      console.log('✅ All doctors already have users. Nothing to do.');
      return;
    }

    // Step 4: Tạo users và update doctors_catalog
    let created = 0;
    let linked = 0;
    let failed = 0;
    const createdUsers = []; // Store for summary

    for (const item of doctorsNeedingUsers) {
      try {
        let userId;

        if (item.action === 'link') {
          // Link to existing user
          userId = item.existingUserId;
          console.log(`🔗 Linking doctor "${item.doctorName}" to existing user ${userId}`);
        } else {
          // Create new user
          const email = generateEmail(item.doctorName);
          const password = generatePassword();

          // Check if email already exists
          let finalEmail = email;
          let emailSuffix = 1;
          while (existingDoctorEmails.has(finalEmail.toLowerCase())) {
            finalEmail = generateEmail(`${item.doctorName}${emailSuffix}`);
            emailSuffix++;
          }

          console.log(`👤 Creating user for doctor: "${item.doctorName}" - ${item.department}`);
          console.log(`   Email: ${finalEmail}`);

          // Create user in Firebase Auth
          const userRecord = await firebaseAdmin.auth().createUser({
            email: finalEmail,
            password: password,
            displayName: item.doctorName,
            emailVerified: false,
          });

          userId = userRecord.uid;

          // Create user document in Firestore
          const userData = {
            uid: userId,
            email: finalEmail,
            fullname: item.doctorName,
            phone: '',
            cccd: '',
            role: 'doctor',
            doctor_name: item.doctorName,
            department: item.department,
            departmentId: item.departmentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await firestore.collection('users').doc(userId).set(userData, { merge: true });

          existingDoctorEmails.add(finalEmail.toLowerCase());
          existingDoctorNames.set(`${item.doctorName}|${item.department}`, userId);

          createdUsers.push({
            doctorName: item.doctorName,
            department: item.department,
            email: finalEmail,
            password: password,
            userId: userId,
          });

          created++;
          console.log(`   ✅ Created user: ${userId}\n`);
        }

        // Update doctors_catalog with user_id
        await item.catalogDoc.ref.update({
          user_id: userId,
          updatedAt: new Date().toISOString(),
        });

        if (item.action === 'link') {
          linked++;
          console.log(`   ✅ Linked to user: ${userId}\n`);
        }
      } catch (err) {
        failed++;
        console.error(`   ❌ Failed for "${item.doctorName}": ${err.message}\n`);
      }
    }

    // Step 5: Summary
    console.log('\n✨ Script completed!\n');
    console.log('Summary:');
    console.log(`  - Users created: ${created}`);
    console.log(`  - Users linked: ${linked}`);
    console.log(`  - Failed: ${failed}`);

    if (createdUsers.length > 0) {
      // Save credentials to file
      const fs = await import('fs');
      const path = await import('path');
      const credentialsFile = path.join(process.cwd(), 'doctor-credentials.json');
      
      const credentialsData = {
        generatedAt: new Date().toISOString(),
        totalCreated: createdUsers.length,
        users: createdUsers.map(u => ({
          doctorName: u.doctorName,
          department: u.department,
          email: u.email,
          password: u.password,
          userId: u.userId,
        })),
      };
      
      fs.writeFileSync(credentialsFile, JSON.stringify(credentialsData, null, 2), 'utf8');
      
      console.log('\n📋 Created users summary:');
      console.log(`  Total: ${createdUsers.length} users created`);
      console.log(`  Credentials saved to: ${credentialsFile}`);
      console.log('\n⚠️  IMPORTANT: Save these credentials! Users should change password on first login.');
      console.log(`\n📄 First 5 users:`);
      createdUsers.slice(0, 5).forEach((user) => {
        console.log(`  - ${user.doctorName} (${user.department}): ${user.email}`);
      });
      if (createdUsers.length > 5) {
        console.log(`  ... and ${createdUsers.length - 5} more (see ${credentialsFile})`);
      }
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  }
}

// Run script
createUsersForDoctors()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
