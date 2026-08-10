import Pharmacy from '../models/Pharmacy.js';

export const getPharmacies = async (req, res) => {
  try {
    const { city, open, sort, search } = req.query;
    
    let query = { status: 'approved' }; // Only show approved pharmacies
    
    console.log('Query params:', req.query);
    console.log('Initial MongoDB query:', query);
    
    if (city && city !== 'all') {
      query.city = city;
      console.log('Added city filter:', city);
    }
    
    if (open === 'true') {
      query.open = true;
      console.log('Added open filter');
    }
    
    // Enhanced search to include medicines
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { 'medicines.name': { $regex: search, $options: 'i' } },
        { 'medicines.genericName': { $regex: search, $options: 'i' } }
      ];
      console.log('Added search filter:', search);
    }
    
    console.log('Final MongoDB query:', JSON.stringify(query, null, 2));
    
    let sortOption = { createdAt: -1 };
    switch(sort) {
      case 'rating': 
        sortOption = { rating: -1 }; 
        break;
      case 'name': 
        sortOption = { name: 1 }; 
        break;
      case 'delivery': 
        sortOption = { deliveryTime: 1 }; 
        break;
      default:
        sortOption = { createdAt: -1 };
    }
    
    console.log('Sort option:', sortOption);
    
    const pharmacies = await Pharmacy.find(query).sort(sortOption).select('-medicines');
    
    console.log(`Found ${pharmacies.length} pharmacies`);
    
    // Log first pharmacy for debugging (if any)
    if (pharmacies.length > 0) {
      console.log('Sample pharmacy:', {
        id: pharmacies[0]._id,
        name: pharmacies[0].name,
        city: pharmacies[0].city,
        status: pharmacies[0].status,
        open: pharmacies[0].open
      });
    }
    
    res.status(200).json({
      success: true,
      count: pharmacies.length,
      data: pharmacies
    });
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get nearby pharmacies based on user location
// @route   GET /api/pharmacies/nearby
// @access  Public
export const getNearbyPharmacies = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000 } = req.query;
    
    console.log('Nearby query:', { lat, lng, maxDistance });
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude (must be between -90 and 90)'
      });
    }
    
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid longitude (must be between -180 and 180)'
      });
    }

    // Fix duplicate 2dsphere indexes if they exist
    try {
      const db = mongoose.connection.db;
      const collection = db.collection('pharmacies');
      const indexes = await collection.indexes();
      const sphereIndexes = indexes.filter(idx => 
        JSON.stringify(idx.key).includes('2dsphere')
      );
      
      if (sphereIndexes.length > 1) {
        console.log(`Found ${sphereIndexes.length} 2dsphere indexes, cleaning up...`);
        for (let i = 1; i < sphereIndexes.length; i++) {
          try {
            await collection.dropIndex(sphereIndexes[i].name);
            console.log(`Dropped index: ${sphereIndexes[i].name}`);
          } catch (err) {
            console.log(`Could not drop index ${sphereIndexes[i].name}:`, err.message);
          }
        }
      }
    } catch (indexError) {
      console.log('Index check/fix error:', indexError.message);
    }

    console.log('Running geoNear aggregation...');

    const pharmacies = await Pharmacy.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          distanceField: 'distance',
          maxDistance: parseInt(maxDistance),
          spherical: true,
          query: {
            status: 'approved',
            location: { $exists: true, $ne: null }
          }
        }
      },
      {
        $project: {
          name: 1,
          address: 1,
          city: 1,
          image: 1,
          deliveryTime: 1,
          rating: 1,
          phone: 1,
          email: 1,
          services: 1,
          deliveryRadius: 1,
          deliveryFee: 1,
          deliverySettings: 1,
          distance: 1,
          distanceFormatted: {
            $concat: [
              { $toString: { $round: [{ $divide: ['$distance', 1000] }, 1] } },
              ' km'
            ]
          }
        }
      },
      {
        $sort: { distance: 1 }
      }
    ]);

    console.log(`Found ${pharmacies.length} nearby pharmacies`);

    res.status(200).json({
      success: true,
      count: pharmacies.length,
      data: pharmacies,
      userLocation: {
        lat: latitude,
        lng: longitude
      }
    });
  } catch (error) {
    console.error('Nearby pharmacies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching nearby pharmacies',
      error: error.message
    });
  }
};

// @desc    Get single pharmacy with medicines
// @route   GET /api/pharmacies/:id
// @access  Public
export const getPharmacyById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid pharmacy ID format' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create new pharmacy (Registration)
// @route   POST /api/pharmacies
// @access  Public (Registration)
export const createPharmacy = async (req, res) => {
  try {
    const { 
      pharmacyName,
      pharmacyType,
      licenseNumber,
      licenseExpiry,
      yearEstablished,
      ownerName,
      email,
      phone,
      address,
      city,
      state,
      latitude,
      longitude,
      location,
      userId
    } = req.body;
    
    console.log('Creating pharmacy with data:', { pharmacyName, city, latitude, longitude });
    
    // Parse location if sent as JSON string
    let locationData;
    if (location) {
      try {
        locationData = typeof location === 'string' ? JSON.parse(location) : location;
      } catch (e) {
        locationData = null;
      }
    }
    
    // If location not provided via location field, use latitude/longitude
    if (!locationData && latitude && longitude) {
      locationData = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
    }
    
    // If still no valid location, use a default (Karachi center) to allow admin creation
    if (!locationData || !locationData.coordinates || locationData.coordinates.length !== 2) {
      locationData = {
        type: "Point",
        coordinates: [67.0011, 24.8607] // Default: Karachi center
      };
    }
    
    // Validate coordinates
    const [lng, lat] = locationData.coordinates;
    if (isNaN(lng) || isNaN(lat) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      locationData = {
        type: "Point",
        coordinates: [67.0011, 24.8607] // Fallback to Karachi
      };
    }
    
    // Prepare pharmacy data
    const pharmacyData = {
      name: pharmacyName || req.body.name,
      address,
      city,
      state,
      location: locationData,
      phone,
      email,
      status: 'pending', // Require admin approval
      open: false, // Will be set to true after approval
      
      // Additional fields from registration form
      licenseNumber,
      licenseExpiry,
      yearEstablished: yearEstablished ? parseInt(yearEstablished) : undefined,
      ownerName,
      pharmacyType,
      
      // Default values
      deliveryTime: '30-45 mins',
      rating: 0,
      services: ['Delivery', 'Prescription'],
      deliveryRadius: 5,
      deliveryFee: 100,
      
      // Delivery settings
      deliverySettings: {
        baseDeliveryCharge: 50,
        perKmCharge: 10,
        freeDeliveryThreshold: 500,
        preparationTime: 15,
        averageDeliverySpeed: 20
      },
      
      // Link to user if provided
      userId: userId || req.user?.id || null
    };
    
    // Remove undefined fields
    Object.keys(pharmacyData).forEach(key => 
      pharmacyData[key] === undefined && delete pharmacyData[key]
    );
    
    const pharmacy = await Pharmacy.create(pharmacyData);
    
    console.log('Pharmacy created successfully:', pharmacy._id);
    
    res.status(201).json({
      success: true,
      message: 'Pharmacy registered successfully. Pending admin approval.',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error creating pharmacy:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ success: false, message: 'Validation Error', errors: messages });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate field value entered' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Update pharmacy
// @route   PUT /api/pharmacies/:id
// @access  Private/Admin
export const updatePharmacy = async (req, res) => {
  try {
    let pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    // Prepare update data
    const updateData = { ...req.body };
    
    // If updating location with latitude and longitude
    if (req.body.latitude && req.body.longitude) {
      updateData.location = {
        type: "Point",
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
      };
    }
    
    // Remove fields that shouldn't be directly updated
    delete updateData.latitude;
    delete updateData.longitude;
    
    // Handle image fields
    if (req.body.logo) {
      updateData.image = req.body.logo;
    }
    
    if (req.body.banner) {
      updateData.bannerImage = req.body.banner;
    }
    
    // Convert numeric fields
    const numericFields = [
      'deliveryRadius', 
      'minimumOrderAmount', 
      'deliveryFee', 
      'freeDeliveryThreshold'
    ];
    
    numericFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateData[field] = Number(updateData[field]);
      }
    });
    
    // Add updated timestamp
    updateData.updatedAt = new Date();
    
    pharmacy = await Pharmacy.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Pharmacy updated successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid pharmacy ID format' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ success: false, message: 'Validation Error', errors: messages });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Delete pharmacy
// @route   DELETE /api/pharmacies/:id
// @access  Private/Admin
export const deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    await pharmacy.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Pharmacy deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('Error deleting pharmacy:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid pharmacy ID format' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get pharmacy statistics
// @route   GET /api/pharmacies/stats
// @access  Public
export const getPharmacyStats = async (req, res) => {
  try {
    console.log('Fetching pharmacy stats...');
    
    const totalPharmacies = await Pharmacy.countDocuments({ status: 'approved' });
    const openPharmacies = await Pharmacy.countDocuments({ status: 'approved', open: true });
    const cities = await Pharmacy.distinct('city', { status: 'approved' });
    
    // Calculate total medicines across all approved pharmacies
    const medicinesAggregate = await Pharmacy.aggregate([
      { $match: { status: 'approved' } },
      { $project: { medicineCount: { $size: '$medicines' } } },
      { $group: { _id: null, totalMedicines: { $sum: '$medicineCount' } } }
    ]);
    
    const totalMedicines = medicinesAggregate[0]?.totalMedicines || 0;
    
    console.log('Stats:', { totalPharmacies, openPharmacies, citiesCount: cities.length, totalMedicines });
    
    res.status(200).json({
      success: true,
      data: {
        totalPharmacies,
        openPharmacies,
        closedPharmacies: totalPharmacies - openPharmacies,
        cities: cities.length,
        totalMedicines,
        emergencyService: '24/7',
        avgDelivery: '30 mins',
        authenticity: '100%'
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get all cities
// @route   GET /api/pharmacies/cities
// @access  Public
export const getCities = async (req, res) => {
  try {
    const cities = await Pharmacy.distinct('city', { status: 'approved' });
    console.log('Cities found:', cities);
    res.status(200).json({ 
      success: true, 
      data: cities.sort() 
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Approve pharmacy (Admin only)
// @route   PUT /api/pharmacies/:id/approve
// @access  Private/Admin
export const approvePharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    pharmacy.status = 'approved';
    pharmacy.open = true;
    await pharmacy.save();
    
    console.log('Pharmacy approved:', pharmacy._id);
    
    res.status(200).json({
      success: true,
      message: 'Pharmacy approved successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error approving pharmacy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Reject pharmacy (Admin only)
// @route   PUT /api/pharmacies/:id/reject
// @access  Private/Admin
export const rejectPharmacy = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    pharmacy.status = 'rejected';
    pharmacy.open = false;
    await pharmacy.save();
    
    console.log('Pharmacy rejected:', pharmacy._id);
    
    res.status(200).json({
      success: true,
      message: 'Pharmacy rejected',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error rejecting pharmacy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// PHARMACY MEDICINE FUNCTIONS
// ========================

// @desc    Add medicine to pharmacy
// @route   POST /api/pharmacies/:id/medicines
// @access  Private/Admin
export const addMedicineToPharmacy = async (req, res) => {
  try {
    const { id } = req.params;
    const medicineData = req.body;
    
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    // Check if medicine already exists (by name)
    const existingMedicine = pharmacy.medicines.find(
      med => med.name.toLowerCase() === medicineData.name.toLowerCase()
    );
    
    if (existingMedicine) {
      return res.status(400).json({
        success: false,
        message: 'Medicine already exists in this pharmacy'
      });
    }
    
    // Calculate discount percentage automatically
    if (medicineData.discountedPrice && medicineData.price > 0) {
      medicineData.discountPercentage = Math.round(
        ((medicineData.price - medicineData.discountedPrice) / medicineData.price) * 100
      );
    }
    
    // Add new medicine
    pharmacy.medicines.push(medicineData);
    await pharmacy.save();
    
    res.status(201).json({
      success: true,
      message: 'Medicine added to pharmacy successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error adding medicine to pharmacy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update medicine in pharmacy
// @route   PUT /api/pharmacies/:pharmacyId/medicines/:medicineId
// @access  Private/Admin
export const updateMedicineInPharmacy = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    const updateData = req.body;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    // Find and update the medicine
    const medicineIndex = pharmacy.medicines.findIndex(
      med => med._id.toString() === medicineId
    );
    
    if (medicineIndex === -1) {
      return res.status(404).json({ success: false, message: 'Medicine not found in pharmacy' });
    }
    
    // Update medicine fields
    Object.assign(pharmacy.medicines[medicineIndex], updateData);
    
    // Recalculate discount if price or discountedPrice changed
    if (updateData.discountedPrice !== undefined || updateData.price !== undefined) {
      const med = pharmacy.medicines[medicineIndex];
      if (med.discountedPrice && med.price > 0) {
        med.discountPercentage = Math.round(
          ((med.price - med.discountedPrice) / med.price) * 100
        );
      } else {
        med.discountPercentage = 0;
      }
    }
    
    await pharmacy.save();
    
    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Remove medicine from pharmacy
// @route   DELETE /api/pharmacies/:pharmacyId/medicines/:medicineId
// @access  Private/Admin
export const removeMedicineFromPharmacy = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    // Remove medicine
    pharmacy.medicines = pharmacy.medicines.filter(
      med => med._id.toString() !== medicineId
    );
    
    await pharmacy.save();
    
    res.status(200).json({
      success: true,
      message: 'Medicine removed from pharmacy successfully',
      data: pharmacy
    });
  } catch (error) {
    console.error('Error removing medicine:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get pharmacy medicines
// @route   GET /api/pharmacies/:id/medicines
// @access  Public
export const getPharmacyMedicines = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, category, minPrice, maxPrice, inStock } = req.query;
    
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    let medicines = pharmacy.medicines;
    
    // Apply filters
    if (search) {
      medicines = medicines.filter(med =>
        med.name.toLowerCase().includes(search.toLowerCase()) ||
        med.genericName?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (category && category !== 'all') {
      medicines = medicines.filter(med => med.category === category);
    }
    
    if (minPrice) {
      medicines = medicines.filter(med => med.price >= Number(minPrice));
    }
    
    if (maxPrice) {
      medicines = medicines.filter(med => med.price <= Number(maxPrice));
    }
    
    if (inStock === 'true') {
      medicines = medicines.filter(med => med.inStock);
    } else if (inStock === 'false') {
      medicines = medicines.filter(med => !med.inStock);
    }
    
    // Calculate discount percentages
    const medicinesWithDiscount = medicines.map(med => {
      const discountPercentage = med.discountedPrice && med.price > 0
        ? Math.round(((med.price - med.discountedPrice) / med.price) * 100)
        : 0;
      
      return {
        ...med.toObject(),
        discountPercentage,
        tabletsPerUnit: med.tabletsPerUnit || med.tabletsPerStrip || 10
      };
    });
    
    res.status(200).json({
      success: true,
      count: medicinesWithDiscount.length,
      data: medicinesWithDiscount
    });
  } catch (error) {
    console.error('Error fetching pharmacy medicines:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get specific medicine from a pharmacy
// @route   GET /api/pharmacies/:pharmacyId/medicines/:medicineId
// @access  Public
export const getMedicineFromPharmacy = async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    
    // Find the pharmacy
    const pharmacy = await Pharmacy.findById(pharmacyId);
    
    if (!pharmacy) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pharmacy not found' 
      });
    }
    
    // Find the specific medicine in the pharmacy's medicines array
    const medicine = pharmacy.medicines.id(medicineId);
    
    if (!medicine) {
      return res.status(404).json({ 
        success: false, 
        message: 'Medicine not found in this pharmacy' 
      });
    }
    
    // Calculate discount percentage if discounted price exists
    let discountPercentage = 0;
    if (medicine.discountedPrice && medicine.price > 0) {
      discountPercentage = Math.round(
        ((medicine.price - medicine.discountedPrice) / medicine.price) * 100
      );
    }
    
    // Prepare the response with medicine details and pharmacy info
    const response = {
      ...medicine.toObject(),
      discountPercentage: discountPercentage,
      tabletsPerUnit: medicine.tabletsPerUnit || medicine.tabletsPerStrip || 10,
      pharmacy: {
        id: pharmacy._id,
        name: pharmacy.name,
        address: pharmacy.address,
        city: pharmacy.city,
        phone: pharmacy.phone,
        email: pharmacy.email,
        deliveryTime: pharmacy.deliveryTime,
        open: pharmacy.open,
        rating: pharmacy.rating,
        location: pharmacy.location,
        deliverySettings: pharmacy.deliverySettings
      }
    };
    
    res.status(200).json({ 
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching medicine from pharmacy:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pharmacy or medicine ID format' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server Error' 
    });
  }
};

// ========================
// AGGREGATED MEDICINE FUNCTIONS
// ========================

// @desc    Get all medicines aggregated from all pharmacies
// @route   GET /api/medicines
// @access  Public
export const getAllMedicines = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice } = req.query;
    
    // Get all approved pharmacies with their medicines
    const pharmacies = await Pharmacy.find({ status: 'approved' });
    
    // Collect all medicines from all pharmacies
    let allMedicines = [];
    
    pharmacies.forEach(pharmacy => {
      pharmacy.medicines.forEach(medicine => {
        // Calculate discount percentage
        const discountPercentage = medicine.discountedPrice && medicine.price > 0
          ? Math.round(((medicine.price - medicine.discountedPrice) / medicine.price) * 100)
          : 0;
        
        // Create unique ID: pharmacyId_medicineId
        const uniqueId = `${pharmacy._id}_${medicine._id}`;
        
        allMedicines.push({
          id: uniqueId,
          _id: medicine._id,
          name: medicine.name,
          genericName: medicine.genericName,
          description: medicine.description,
          detailedDescription: medicine.detailedDescription,
          category: medicine.category,
          strength: medicine.strength,
          form: medicine.form,
          manufacturer: medicine.manufacturer,
          image: medicine.image,
          prescriptionRequired: medicine.prescriptionRequired,
          sideEffects: medicine.sideEffects || [],
          uses: medicine.uses || [],
          precautions: medicine.precautions || [],
          instructions: medicine.instructions || [],
          storageInstructions: medicine.storageInstructions,
          dosage: medicine.dosage,
          tabletsPerUnit: medicine.tabletsPerUnit || medicine.tabletsPerStrip || 10,
          // Pharmacy-specific pricing
          price: medicine.price,
          discountedPrice: medicine.discountedPrice,
          discountPercentage: discountPercentage,
          inStock: medicine.inStock,
          stockQuantity: medicine.stockQuantity,
          // Pharmacy info
          pharmacyId: pharmacy._id,
          pharmacyName: pharmacy.name,
          pharmacyCity: pharmacy.city,
          pharmacyAddress: pharmacy.address,
          pharmacyDeliveryTime: pharmacy.deliveryTime,
          pharmacyRating: pharmacy.rating,
          pharmacyOpen: pharmacy.open,
          pharmacyLocation: pharmacy.location
        });
      });
    });
    
    // Apply filters
    let filteredMedicines = allMedicines;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMedicines = filteredMedicines.filter(med =>
        med.name.toLowerCase().includes(searchLower) ||
        med.genericName?.toLowerCase().includes(searchLower) ||
        med.description.toLowerCase().includes(searchLower)
      );
    }
    
    if (category && category !== 'all') {
      filteredMedicines = filteredMedicines.filter(med => med.category === category);
    }
    
    if (minPrice) {
      filteredMedicines = filteredMedicines.filter(med => med.price >= Number(minPrice));
    }
    
    if (maxPrice) {
      filteredMedicines = filteredMedicines.filter(med => med.price <= Number(maxPrice));
    }
    
    // Group by medicine name for aggregated view (optional)
    if (req.query.group === 'true') {
      const groupedMedicines = {};
      
      filteredMedicines.forEach(med => {
        if (!groupedMedicines[med.name]) {
          groupedMedicines[med.name] = {
            name: med.name,
            genericName: med.genericName,
            description: med.description,
            category: med.category,
            image: med.image,
            prescriptionRequired: med.prescriptionRequired,
            availableAt: [],
            lowestPrice: med.price,
            highestPrice: med.price,
            tabletsPerUnit: med.tabletsPerUnit
          };
        }
        
        groupedMedicines[med.name].availableAt.push({
          pharmacyId: med.pharmacyId,
          pharmacyName: med.pharmacyName,
          pharmacyCity: med.pharmacyCity,
          price: med.price,
          discountedPrice: med.discountedPrice,
          discountPercentage: med.discountPercentage,
          inStock: med.inStock,
          uniqueId: med.id
        });
        
        // Update price stats
        if (med.price < groupedMedicines[med.name].lowestPrice) {
          groupedMedicines[med.name].lowestPrice = med.price;
        }
        if (med.price > groupedMedicines[med.name].highestPrice) {
          groupedMedicines[med.name].highestPrice = med.price;
        }
      });
      
      filteredMedicines = Object.values(groupedMedicines);
    }
    
    res.status(200).json({
      success: true,
      count: filteredMedicines.length,
      data: filteredMedicines
    });
  } catch (error) {
    console.error('Error aggregating medicines:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get medicine details with all pharmacy prices (aggregated)
// @route   GET /api/medicines/:name
// @access  Public
export const getMedicineByName = async (req, res) => {
  try {
    const { name } = req.params;
    
    // Find all approved pharmacies that have this medicine
    const pharmacies = await Pharmacy.find({
      status: 'approved',
      'medicines.name': { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (pharmacies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }
    
    // Extract medicine details from first pharmacy
    const firstPharmacy = pharmacies[0];
    const medicineDetails = firstPharmacy.medicines.find(med => 
      med.name.toLowerCase() === name.toLowerCase()
    );
    
    if (!medicineDetails) {
      return res.status(404).json({
        success: false,
        message: 'Medicine details not found'
      });
    }
    
    // Collect all pharmacy prices
    const pharmacyPrices = pharmacies.map(pharmacy => {
      const pharmacyMedicine = pharmacy.medicines.find(med => 
        med.name.toLowerCase() === name.toLowerCase()
      );
      
      if (!pharmacyMedicine) return null;
      
      // Calculate discount
      const discountPercentage = pharmacyMedicine.discountedPrice && pharmacyMedicine.price > 0
        ? Math.round(((pharmacyMedicine.price - pharmacyMedicine.discountedPrice) / pharmacyMedicine.price) * 100)
        : 0;
      
      return {
        pharmacyId: pharmacy._id,
        pharmacyName: pharmacy.name,
        pharmacyCity: pharmacy.city,
        pharmacyAddress: pharmacy.address,
        pharmacyImage: pharmacy.image,
        deliveryTime: pharmacy.deliveryTime,
        rating: pharmacy.rating,
        open: pharmacy.open,
        location: pharmacy.location,
        // Medicine-specific in this pharmacy
        price: pharmacyMedicine.price,
        discountedPrice: pharmacyMedicine.discountedPrice,
        discountPercentage: discountPercentage,
        inStock: pharmacyMedicine.inStock,
        stockQuantity: pharmacyMedicine.stockQuantity,
        // Combined ID for frontend
        uniqueId: `${pharmacy._id}_${pharmacyMedicine._id}`
      };
    }).filter(item => item !== null);
    
    // Sort by price (lowest first)
    pharmacyPrices.sort((a, b) => {
      const priceA = a.discountedPrice || a.price;
      const priceB = b.discountedPrice || b.price;
      return priceA - priceB;
    });
    
    // Calculate statistics
    const prices = pharmacyPrices.map(p => p.discountedPrice || p.price);
    const stats = {
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averagePrice: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
      pharmaciesWithDiscount: pharmacyPrices.filter(p => p.discountedPrice).length,
      totalPharmacies: pharmacyPrices.length
    };
    
    // Common medicine details (from first pharmacy)
    const commonDetails = {
      name: medicineDetails.name,
      genericName: medicineDetails.genericName,
      description: medicineDetails.description,
      detailedDescription: medicineDetails.detailedDescription,
      category: medicineDetails.category,
      strength: medicineDetails.strength,
      form: medicineDetails.form,
      manufacturer: medicineDetails.manufacturer,
      image: medicineDetails.image,
      prescriptionRequired: medicineDetails.prescriptionRequired,
      sideEffects: medicineDetails.sideEffects || [],
      uses: medicineDetails.uses || [],
      precautions: medicineDetails.precautions || [],
      instructions: medicineDetails.instructions || [],
      storageInstructions: medicineDetails.storageInstructions,
      dosage: medicineDetails.dosage,
      tabletsPerUnit: medicineDetails.tabletsPerUnit || medicineDetails.tabletsPerStrip || 10
    };
    
    res.status(200).json({
      success: true,
      data: {
        medicine: commonDetails,
        availableAt: pharmacyPrices,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching aggregated medicine details:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get medicine categories
// @route   GET /api/medicines/categories
// @access  Public
export const getMedicineCategories = async (req, res) => {
  try {
    // Get distinct categories from all medicines in approved pharmacies
    const categories = await Pharmacy.aggregate([
      { $match: { status: 'approved' } },
      { $unwind: '$medicines' },
      { $group: { _id: '$medicines.category' } },
      { $sort: { _id: 1 } }
    ]);
    
    const categoryList = categories.map(cat => cat._id).filter(Boolean);
    
    res.status(200).json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get medicine statistics
// @route   GET /api/medicines/stats
// @access  Public
export const getMedicineStats = async (req, res) => {
  try {
    // Get total medicines count from approved pharmacies
    const medicineCount = await Pharmacy.aggregate([
      { $match: { status: 'approved' } },
      { $project: { medicineCount: { $size: '$medicines' } } },
      { $group: { _id: null, totalMedicines: { $sum: '$medicineCount' } } }
    ]);
    
    const totalMedicines = medicineCount[0]?.totalMedicines || 0;
    
    // Get categories count
    const categoryCount = await Pharmacy.aggregate([
      { $match: { status: 'approved' } },
      { $unwind: '$medicines' },
      { $group: { _id: '$medicines.category' } },
      { $count: 'totalCategories' }
    ]);
    
    const totalCategories = categoryCount[0]?.totalCategories || 0;
    
    // Get unique medicines count (by name)
    const uniqueMedicines = await Pharmacy.aggregate([
      { $match: { status: 'approved' } },
      { $unwind: '$medicines' },
      { $group: { _id: '$medicines.name' } },
      { $count: 'uniqueCount' }
    ]);
    
    const uniqueMedicineCount = uniqueMedicines[0]?.uniqueCount || 0;
    
    // Get low stock and out of stock counts
    const stockStats = await Pharmacy.aggregate([
      { $match: { status: 'approved' } },
      { $unwind: '$medicines' },
      {
        $group: {
          _id: null,
          outOfStock: {
            $sum: { $cond: [{ $eq: ['$medicines.inStock', false] }, 1, 0] }
          },
          lowStock: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ['$medicines.inStock', true] },
                    { $lte: ['$medicines.stockQuantity', '$medicines.reorderLevel'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const outOfStock = stockStats[0]?.outOfStock || 0;
    const lowStock = stockStats[0]?.lowStock || 0;
    
    res.status(200).json({
      success: true,
      data: {
        totalMedicines,
        uniqueMedicines: uniqueMedicineCount,
        totalCategories,
        outOfStock,
        lowStock,
        expiringSoon: 0
      }
    });
  } catch (error) {
    console.error('Error fetching medicine stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
