import dotenv from 'dotenv';
dotenv.config();

import { firestore } from '../src/config/firebase.js';
import { getDoctorCatalogByUserId } from '../src/infrastructure/services/firebase.services.js';

async function checkDoctorProfile() {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  // Test với user_id từ image
  const userId = 'ka78HIdEJrSS66AchA31lTIYlD72';
  console.log('🔍 Checking doctor profile for userId:', userId);
  console.log('');

  // 1. Check user
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
  console.log('  - Doctor name:', userData.doctor_name || 'N/A');
  console.log('  - Department:', userData.department || 'N/A');
  console.log('');

  // 2. Check doctors_catalog
  console.log('🔍 Checking doctors_catalog...');
  const catalogSnap = await firestore
    .collection('doctors_catalog')
    .where('user_id', '==', userId)
    .get();

  if (catalogSnap.empty) {
    console.log('❌ No doctor catalog found with user_id:', userId);
    console.log('');
    
    // Check by doctor name
    const doctorName = userData.doctor_name || userData.fullname;
    if (doctorName) {
      console.log('🔍 Trying to find by doctor name:', doctorName);
      const nameSnap = await firestore
        .collection('doctors_catalog')
        .where('doctor', '==', doctorName)
        .get();
      
      if (nameSnap.empty) {
        console.log('❌ No doctor catalog found with doctor name:', doctorName);
      } else {
        console.log(`⚠️  Found ${nameSnap.size} catalog entries by name, but no user_id match:`);
        nameSnap.forEach(doc => {
          const data = doc.data();
          console.log(`  - ID: ${doc.id}, Doctor: ${data.doctor}, Department: ${data.department}, user_id: ${data.user_id || 'N/A'}`);
        });
      }
    }
  } else {
    console.log(`✅ Found ${catalogSnap.size} catalog entry(ies):`);
    catalogSnap.forEach(doc => {
      const data = doc.data();
      console.log('  - ID:', doc.id);
      console.log('  - Doctor:', data.doctor);
      console.log('  - Department:', data.department);
      console.log('  - DepartmentId:', data.departmentId || 'N/A');
      console.log('  - Status:', data.status);
      console.log('  - user_id:', data.user_id);
    });
  }

  // 3. Test getDoctorCatalogByUserId
  console.log('');
  console.log('🔍 Testing getDoctorCatalogByUserId...');
  try {
    const catalog = await getDoctorCatalogByUserId(userId);
    if (catalog) {
      console.log('✅ getDoctorCatalogByUserId returned:');
      console.log(JSON.stringify(catalog, null, 2));
    } else {
      console.log('❌ getDoctorCatalogByUserId returned null');
    }
  } catch (error) {
    console.log('❌ Error calling getDoctorCatalogByUserId:', error.message);
  }

  process.exit(0);
}

checkDoctorProfile().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
