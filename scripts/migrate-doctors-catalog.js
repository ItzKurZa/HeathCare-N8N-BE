import dotenv from 'dotenv';
dotenv.config();

import { firestore } from '../src/config/firebase.js';

/**
 * Migration script: Thêm user_id vào doctors_catalog
 * 
 * Logic:
 * 1. Lấy tất cả doctors_catalog records
 * 2. Với mỗi record, tìm user có doctor_name + department match
 * 3. Update doctors_catalog với user_id
 * 
 * Usage:
 *   node scripts/migrate-doctors-catalog.js
 */
async function migrateDoctorsCatalog() {
  try {
    console.log('🚀 Starting migration: Add user_id to doctors_catalog...\n');
    
    if (!firestore) {
      throw new Error('Firestore not initialized. Please check your Firebase credentials.');
    }
    
    // Lấy tất cả doctors_catalog
    const catalogSnap = await firestore.collection('doctors_catalog').get();
    console.log(`📋 Found ${catalogSnap.size} doctors in catalog`);
    
    // Lấy tất cả users với role='doctor'
    const usersSnap = await firestore
      .collection('users')
      .where('role', '==', 'doctor')
      .get();
    console.log(`👤 Found ${usersSnap.size} doctor users\n`);
    
    // Tạo map: doctor_name + department -> user_id
    const doctorUserMap = new Map();
    usersSnap.forEach(doc => {
      const user = doc.data();
      const doctorName = (user.doctor_name || user.fullname || '').trim();
      const department = (user.department || '').trim();
      const key = `${doctorName}|${department}`;
      
      if (key && key !== '|' && doctorName && department) {
        doctorUserMap.set(key, user.uid);
        console.log(`  📌 Mapped: "${doctorName}" - "${department}" -> ${user.uid}`);
      }
    });
    
    console.log(`\n✅ Created map with ${doctorUserMap.size} doctor users\n`);
    
    // Update doctors_catalog
    const batch = firestore.batch();
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    
    catalogSnap.forEach(doc => {
      const data = doc.data();
      const doctor = (data.doctor || '').trim();
      const department = (data.department || '').trim();
      const key = `${doctor}|${department}`;
      
      const userId = doctorUserMap.get(key);
      
      if (userId) {
        // Check xem đã có user_id chưa (tránh update không cần thiết)
        if (data.user_id !== userId) {
          batch.update(doc.ref, {
            user_id: userId,
            updated_at: now
          });
          updated++;
          console.log(`  ✅ Will update: "${doctor}" - "${department}" -> user_id: ${userId}`);
        } else {
          console.log(`  ⏭️  Already has user_id: "${doctor}" - "${department}"`);
        }
      } else {
        skipped++;
        console.log(`  ⚠️  No user found for: "${doctor}" - "${department}"`);
      }
    });
    
    if (updated > 0) {
      console.log(`\n💾 Committing ${updated} updates...`);
      await batch.commit();
      console.log(`\n✅ Migration completed successfully!`);
      console.log(`   - Updated: ${updated} records`);
      console.log(`   - Skipped: ${skipped} records (no matching user)`);
    } else {
      console.log(`\n⚠️  No records to update`);
      if (skipped > 0) {
        console.log(`   - Skipped: ${skipped} records (no matching user)`);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    console.error(err.stack);
    process.exit(1);
  }
}

migrateDoctorsCatalog();
