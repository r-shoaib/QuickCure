import mongoose from 'mongoose';
import Pharmacy from './models/Pharmacy.js';

async function populateLocations() {
  try {
    await mongoose.connect('mongodb://localhost:27017/quickcure');
    console.log('Connected to MongoDB');

    // Find all pharmacies without location or with empty coordinates
    const pharmaciesWithoutLocation = await Pharmacy.find({
      $or: [
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': { $size: 0 } },
        { 'location.coordinates': null }
      ]
    });

    console.log(`Found ${pharmaciesWithoutLocation.length} pharmacies without location data`);

    // Default locations for major Pakistani cities (longitude, latitude)
    const cityCoordinates = {
      'karachi': [67.0011, 24.8607],
      'lahore': [74.3587, 31.5204],
      'islamabad': [73.0479, 33.6844],
      'rawalpindi': [73.0479, 33.6844],
      'faisalabad': [73.0745, 31.4504],
      'multan': [71.4749, 30.1575],
      'peshawar': [71.5249, 34.0151],
      'quetta': [67.0011, 30.1798],
      'hyderabad': [68.3714, 25.3960],
      'sialkot': [74.5213, 32.4945],
      'gujranwala': [74.1875, 32.1606],
      'bahawalpur': [71.6771, 29.3956],
      'sargodha': [72.6711, 32.0836],
      'sukkur': [68.8574, 27.7052],
      'larkana': [68.2144, 27.5558],
      'sheikhupura': [73.9850, 31.7169],
      'mirpur khas': [69.0111, 25.5273],
      'rahim yar khan': [70.3022, 28.4212],
      'gujrat': [74.0814, 32.5736],
      'jhang': [72.3278, 31.2698],
      'mardan': [72.0426, 34.1989],
      'kasur': [74.4447, 31.1157],
      'mingora': [72.3641, 34.7686],
      'dera ghazi khan': [70.6343, 30.0459],
      'sahiwal': [73.4019, 30.6667],
      'nawabshah': [68.4124, 26.2484],
      'khairpur': [68.7522, 27.5295],
      'turbat': [63.0528, 26.0019],
      'abbottabad': [73.2146, 34.1688],
      'charsadda': [71.7311, 34.1483]
    };

    let updatedCount = 0;

    for (const pharmacy of pharmaciesWithoutLocation) {
      // Try to match city to coordinates
      const cityLower = pharmacy.city?.toLowerCase() || '';
      let coords = cityCoordinates[cityLower];

      // If city not found, use Karachi as default
      if (!coords) {
        console.log(`City "${pharmacy.city}" not found in mapping, using Karachi as default`);
        coords = [67.0011, 24.8607];
      }

      // Add small random offset to avoid all pharmacies at same location
      const latOffset = (Math.random() - 0.5) * 0.1; // ±0.05 degrees
      const lngOffset = (Math.random() - 0.5) * 0.1;
      
      pharmacy.location = {
        type: 'Point',
        coordinates: [
          coords[0] + lngOffset, // longitude
          coords[1] + latOffset  // latitude
        ]
      };

      await pharmacy.save();
      updatedCount++;
      console.log(`Updated: ${pharmacy.name} (${pharmacy.city}) - [${pharmacy.location.coordinates[0].toFixed(4)}, ${pharmacy.location.coordinates[1].toFixed(4)}]`);
    }

    console.log(`\nSuccessfully updated ${updatedCount} pharmacies with location data`);

    // Verify the update
    const totalPharmacies = await Pharmacy.countDocuments({});
    const withLocation = await Pharmacy.countDocuments({ 
      'location.coordinates': { $exists: true, $ne: [] } 
    });

    console.log(`\nVerification:`);
    console.log(`Total pharmacies: ${totalPharmacies}`);
    console.log(`Pharmacies with location: ${withLocation}`);
    console.log(`Coverage: ${((withLocation / totalPharmacies) * 100).toFixed(1)}%`);

    await mongoose.connection.close();
    console.log('\nConnection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

populateLocations();