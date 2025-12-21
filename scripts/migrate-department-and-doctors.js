/**
 * Migration script: Tạo bảng department và nối với doctors_catalog qua departmentId
 * 
 * Steps:
 * 1. Tạo collection 'departments' từ các department name unique trong doctors_catalog
 * 2. Thêm departmentId vào doctors_catalog
 * 3. Map userId từ users sang doctors_catalog (nếu chưa có)
 */

import dotenv from 'dotenv';
dotenv.config();

import { firestore } from '../src/config/firebase.js';

async function migrateDepartmentAndDoctors() {
  try {
    if (!firestore) {
      throw new Error('Firestore not initialized. Please check your Firebase credentials.');
    }
    
    console.log('🚀 Starting migration: Create departments and link with doctors_catalog...\n');

    // Step 1: Lấy tất cả doctors_catalog để extract unique departments
    const catalogSnap = await firestore.collection('doctors_catalog').get();
    console.log(`📋 Found ${catalogSnap.size} doctor records in catalog\n`);

    if (catalogSnap.empty) {
      console.log('⚠️  No doctors found. Migration skipped.');
      return;
    }

    // Extract unique departments
    const departmentMap = new Map(); // Map: departmentName -> departmentId
    const departmentsToCreate = new Set();

    catalogSnap.forEach((doc) => {
      const data = doc.data();
      const deptName = data.department;
      if (deptName && !departmentsToCreate.has(deptName)) {
        departmentsToCreate.add(deptName);
      }
    });

    console.log(`📦 Found ${departmentsToCreate.size} unique departments:\n`);
    departmentsToCreate.forEach(dept => console.log(`  - ${dept}`));
    console.log('');

    // Step 2: Tạo departments collection
    const batch = firestore.batch();
    let deptCount = 0;

    for (const deptName of departmentsToCreate) {
      // Check if department already exists
      const existingDept = await firestore
        .collection('departments')
        .where('name', '==', deptName)
        .get();

      if (existingDept.empty) {
        const deptRef = firestore.collection('departments').doc();
        const deptId = deptRef.id;
        
        batch.set(deptRef, {
          id: deptId,
          name: deptName,
          description: `Khoa ${deptName}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        departmentMap.set(deptName, deptId);
        deptCount++;
      } else {
        // Department đã tồn tại, lấy ID
        const existingId = existingDept.docs[0].id;
        departmentMap.set(deptName, existingId);
      }
    }

    if (deptCount > 0) {
      await batch.commit();
      console.log(`✅ Created ${deptCount} new departments\n`);
    } else {
      console.log(`✅ All departments already exist\n`);
    }

    // Step 3: Update doctors_catalog với departmentId
    console.log('🔄 Updating doctors_catalog with departmentId...\n');
    const updateBatch = firestore.batch();
    let updateCount = 0;

    catalogSnap.forEach((doc) => {
      const data = doc.data();
      const deptName = data.department;
      const deptId = departmentMap.get(deptName);

      if (deptId && !data.departmentId) {
        updateBatch.update(doc.ref, {
          departmentId: deptId,
          updatedAt: new Date().toISOString(),
        });
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await updateBatch.commit();
      console.log(`✅ Updated ${updateCount} doctor records with departmentId\n`);
    } else {
      console.log(`✅ All doctors already have departmentId\n`);
    }

    // Step 4: Map userId từ users sang doctors_catalog (nếu chưa có)
    console.log('🔄 Mapping userId from users to doctors_catalog...\n');
    
    // Lấy tất cả users với role = 'doctor'
    const usersSnap = await firestore
      .collection('users')
      .where('role', '==', 'doctor')
      .get();

    console.log(`📋 Found ${usersSnap.size} users with doctor role\n`);

    const userMappingBatch = firestore.batch();
    let mappingCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const doctorName = userData.doctor_name || userData.fullname;
      const department = userData.department;

      if (!doctorName || !department) {
        console.log(`⚠️  User ${userId} (${userData.email}) missing doctor_name or department, skipping...`);
        continue;
      }

      // Tìm doctor trong catalog
      const doctorSnap = await firestore
        .collection('doctors_catalog')
        .where('doctor', '==', doctorName)
        .where('department', '==', department)
        .get();

      if (!doctorSnap.empty) {
        // Update doctors_catalog với userId
        doctorSnap.docs.forEach((doc) => {
          const catalogData = doc.data();
          if (!catalogData.user_id || catalogData.user_id !== userId) {
            userMappingBatch.update(doc.ref, {
              user_id: userId,
              updatedAt: new Date().toISOString(),
            });
            mappingCount++;
            console.log(`  ✅ Mapped user ${userId} to doctor ${doctorName} - ${department}`);
          }
        });
      } else {
        // Tạo mới doctor trong catalog
        const deptId = departmentMap.get(department);
        if (deptId) {
          const newDoctorRef = firestore.collection('doctors_catalog').doc();
          userMappingBatch.set(newDoctorRef, {
            id: newDoctorRef.id,
            doctor: doctorName,
            department: department,
            departmentId: deptId,
            user_id: userId,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          mappingCount++;
          console.log(`  ✅ Created new doctor catalog entry for user ${userId}: ${doctorName} - ${department}`);
        }
      }
    }

    if (mappingCount > 0) {
      await userMappingBatch.commit();
      console.log(`\n✅ Mapped ${mappingCount} doctor records with userId\n`);
    } else {
      console.log(`\n✅ All doctors already have userId mapped\n`);
    }

    console.log('✨ Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`  - Departments created/verified: ${departmentsToCreate.size}`);
    console.log(`  - Doctors updated with departmentId: ${updateCount}`);
    console.log(`  - Doctors mapped with userId: ${mappingCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateDepartmentAndDoctors()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
