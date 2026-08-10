import mongoose from 'mongoose';

async function checkPharmacies() {
  try {
    await mongoose.connect('mongodb://localhost:27017/quickcure');
    console.log('Connected to MongoDB');
    
    const Pharmacy = (await import('./models/Pharmacy.js')).default;
    
    const count = await Pharmacy.countDocuments({});
    const withLocation = await Pharmacy.countDocuments({ 
      'location.coordinates': { $exists: true, $ne: [] } 
    });
    
    console.log('Total pharmacies:', count);
    console.log('Pharmacies with location:', withLocation);
    
    const sample = await Pharmacy.findOne({ 
      'location.coordinates': { $exists: true, $ne: [] } 
    });
    
    if (sample) {
      console.log('Sample pharmacy:', {
        name: sample.name,
        location: sample.location,
        city: sample.city
      });
    } else {
      console.log('No pharmacies with location found');
    }
    
    await mongoose.connection.close();
    console.log('Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkPharmacies();