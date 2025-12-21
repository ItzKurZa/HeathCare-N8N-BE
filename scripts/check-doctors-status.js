import dotenv from 'dotenv';
dotenv.config();

import { firestore } from '../src/config/firebase.js';

async function checkStatus() {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  // Check doctors_catalog
  const catalog = await firestore.collection('doctors_catalog').get();
  let withUserId = 0;
  let withoutUserId = 0;
  
  catalog.forEach(doc => {
    const data = doc.data();
    if (data.user_id) withUserId++;
    else withoutUserId++;
  });

  // Check doctor users
  const users = await firestore.collection('users').where('role', '==', 'doctor').get();

  console.log('📊 Doctors Catalog Status:');
  console.log(`  - Total doctors: ${catalog.size}`);
  console.log(`  - With user_id: ${withUserId}`);
  console.log(`  - Without user_id: ${withoutUserId}`);
  console.log(`\n👤 Doctor Users:`);
  console.log(`  - Total: ${users.size}`);
  
  process.exit(0);
}

checkStatus().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
