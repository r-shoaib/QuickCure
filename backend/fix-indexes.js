import mongoose from 'mongoose';
import Pharmacy from './models/Pharmacy.js';

async function fixIndexes() {
  try {
    await mongoose.connect('mongodb://localhost:27017/quickcure');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('pharmacies');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('\nCurrent indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Find duplicate 2dsphere indexes
    const sphereIndexes = indexes.filter(idx => 
      JSON.stringify(idx.key).includes('2dsphere')
    );

    console.log(`\nFound ${sphereIndexes.length} 2dsphere index(es)`);

    if (sphereIndexes.length > 1) {
      console.log('\nDropping duplicate 2dsphere indexes...');
      
      // Keep the first one, drop the rest
      for (let i = 1; i < sphereIndexes.length; i++) {
        const indexName = sphereIndexes[i].name;
        console.log(`Dropping index: ${indexName}`);
        await collection.dropIndex(indexName);
      }
      
      console.log('Duplicate indexes dropped successfully');
    } else {
      console.log('No duplicate 2dsphere indexes found');
    }

    // Ensure the correct index exists
    console.log('\nEnsuring location 2dsphere index exists...');
    await collection.createIndex(
      { location: '2dsphere' },
      { 
        name: 'location_2dsphere',
        background: true 
      }
    );
    console.log('Index created/verified: location_2dsphere');

    // Verify final state
    const finalIndexes = await collection.indexes();
    console.log('\nFinal indexes:');
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const sphereCount = finalIndexes.filter(idx => 
      JSON.stringify(idx.key).includes('2dsphere')
    ).length;
    
    console.log(`\n✓ 2dsphere indexes: ${sphereCount} (should be 1)`);

    await mongoose.connection.close();
    console.log('\nConnection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixIndexes();