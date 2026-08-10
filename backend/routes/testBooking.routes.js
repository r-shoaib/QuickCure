import express from "express";
import Booking from "../models/testBooking.models.js";
import Lab from "../models/lab.model.js";
import Test from "../models/test.model.js";
const router = express.Router();

// Generate a unique booking reference for each booking
const generateBookingReference = async (isGroupBooking = false, groupIndex = 0) => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  if (isGroupBooking) {
    // For group bookings, use same base reference but add patient index
    const baseReference = `BK${year}${month}${day}`;
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${baseReference}${random}`;
  } else {
    // For single bookings, just use random
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BK${year}${month}${day}${random}`;
  }
};

// Helper function to calculate total amount
const calculateTotalAmount = async (labId, testIds) => {
  try {
    const lab = await Lab.findById(labId);
    const tests = await Test.find({ _id: { $in: testIds } });
    
    const originalTotal = tests.reduce((sum, test) => sum + Number(test.price), 0);
    const discount = lab?.discount || 0;
    const finalTotal = Math.round(originalTotal - (originalTotal * discount / 100));
    
    return {
      original: originalTotal,
      discounted: finalTotal,
      discount: discount,
      saved: originalTotal - finalTotal
    };
  } catch (error) {
    console.error('Error calculating total:', error);
    return {
      original: 0,
      discounted: 0,
      discount: 0,
      saved: 0
    };
  }
};

// ✅ Get all bookings for a specific patient by email
router.get('/patient/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { status } = req.query;

    // Build query
    const query = { 
      'patientDetails.email': email.toLowerCase() 
    };
    
    // Add status filter if provided
    if (status) {
      query.bookingStatus = status;
    }

    // Find all bookings for this patient
    const bookings = await Booking.find(query)
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description')
      .sort('-createdAt'); // Most recent first

    // If no bookings found
    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No bookings found for this patient',
        count: 0,
        data: []
      });
    }

    // Group bookings by groupId for better organization
    const groupedBookings = {};
    const individualBookings = [];

    bookings.forEach(booking => {
      if (booking.groupBooking && booking.groupId) {
        if (!groupedBookings[booking.groupId]) {
          groupedBookings[booking.groupId] = {
            groupId: booking.groupId,
            lab: booking.lab,
            patientsCount: booking.totalPatients,
            bookings: []
          };
        }
        groupedBookings[booking.groupId].bookings.push({
          ...booking.toObject(),
          patientDetails: {
            ...booking.patientDetails.toObject(),
            appointmentDate: booking.appointmentDetails.preferredDate
          }
        });
      } else {
        individualBookings.push({
          ...booking.toObject(),
          patientDetails: {
            ...booking.patientDetails.toObject(),
            appointmentDate: booking.appointmentDetails.preferredDate
          }
        });
      }
    });

    // Format response
    const formattedResponse = {
      individual: individualBookings,
      groups: Object.values(groupedBookings)
    };

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: formattedResponse,
      allBookings: bookings.map(booking => ({
        ...booking.toObject(),
        patientDetails: {
          ...booking.patientDetails.toObject(),
          appointmentDate: booking.appointmentDetails.preferredDate
        }
      }))
    });

  } catch (error) {
    console.error('Error fetching patient bookings by email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch bookings',
      details: error.message 
    });
  }
});

// ✅ Get all bookings for a specific patient by phone number
router.get('/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { status } = req.query;

    // Build query
    const query = { 
      'patientDetails.mobile': phone 
    };
    
    // Add status filter if provided
    if (status) {
      query.bookingStatus = status;
    }

    // Find all bookings for this patient
    const bookings = await Booking.find(query)
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description')
      .sort('-createdAt'); // Most recent first

    // If no bookings found
    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No bookings found for this patient',
        count: 0,
        data: []
      });
    }

    // Group bookings by groupId for better organization
    const groupedBookings = {};
    const individualBookings = [];

    bookings.forEach(booking => {
      if (booking.groupBooking && booking.groupId) {
        if (!groupedBookings[booking.groupId]) {
          groupedBookings[booking.groupId] = {
            groupId: booking.groupId,
            lab: booking.lab,
            patientsCount: booking.totalPatients,
            bookings: []
          };
        }
        groupedBookings[booking.groupId].bookings.push({
          ...booking.toObject(),
          patientDetails: {
            ...booking.patientDetails.toObject(),
            appointmentDate: booking.appointmentDetails.preferredDate
          }
        });
      } else {
        individualBookings.push({
          ...booking.toObject(),
          patientDetails: {
            ...booking.patientDetails.toObject(),
            appointmentDate: booking.appointmentDetails.preferredDate
          }
        });
      }
    });

    // Format response
    const formattedResponse = {
      individual: individualBookings,
      groups: Object.values(groupedBookings)
    };

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: formattedResponse,
      allBookings: bookings.map(booking => ({
        ...booking.toObject(),
        patientDetails: {
          ...booking.patientDetails.toObject(),
          appointmentDate: booking.appointmentDetails.preferredDate
        }
      }))
    });

  } catch (error) {
    console.error('Error fetching patient bookings by phone:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch bookings',
      details: error.message 
    });
  }
});

// ✅ Get all bookings for a specific patient by email or phone (unified endpoint)
router.get('/patient/search', async (req, res) => {
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either email or phone number'
      });
    }

    // Build search query
    const searchQuery = {};
    if (email) {
      searchQuery['patientDetails.email'] = email.toLowerCase();
    }
    if (phone) {
      searchQuery['patientDetails.mobile'] = phone;
    }

    // Find bookings matching either email or phone
    const bookings = await Booking.find({
      $or: [
        { 'patientDetails.email': email?.toLowerCase() },
        { 'patientDetails.mobile': phone }
      ].filter(condition => Object.values(condition)[0] !== undefined)
    })
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings.map(booking => ({
        ...booking.toObject(),
        patientDetails: {
          ...booking.patientDetails.toObject(),
          appointmentDate: booking.appointmentDetails.preferredDate
        }
      }))
    });

  } catch (error) {
    console.error('Error searching patient bookings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search bookings',
      details: error.message 
    });
  }
});

// ✅ Multiple patients booking route
router.post('/multiple', async (req, res) => {
  try {
    console.log('Multiple booking request received:', req.body);
    
    const { labId, patients, serviceCity } = req.body;

    // Validate required fields
    if (!labId || !patients || !patients.length) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { 
          labId: !!labId, 
          patientsCount: patients?.length
        }
      });
    }

    // Validate lab exists
    const lab = await Lab.findById(labId);
    if (!lab) {
      console.log('Lab not found:', labId);
      return res.status(404).json({ error: 'Lab not found' });
    }

    // Collect all test IDs from all patients
    const allTestIds = patients.flatMap(p => p.testIds);
    
    // Validate tests exist
    const tests = await Test.find({ _id: { $in: allTestIds } });
    const foundTestIds = tests.map(t => t._id.toString());
    const missingTests = allTestIds.filter(id => !foundTestIds.includes(id.toString()));
    
    if (missingTests.length > 0) {
      console.log('Tests not found:', missingTests);
      return res.status(404).json({ 
        error: 'One or more tests not found',
        missingTests
      });
    }

    // Validate each patient's details (including appointmentDate)
    const requiredPatientFields = ['name', 'age', 'gender', 'mobile', 'email', 'address', 'appointmentDate'];
    const patientErrors = [];
    
    patients.forEach((patient, index) => {
      const missingFields = requiredPatientFields.filter(
        field => !patient.patientDetails?.[field]
      );
      
      if (missingFields.length > 0) {
        patientErrors.push({
          patientIndex: index + 1,
          missingFields
        });
      }
    });

    if (patientErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Missing patient details',
        patients: patientErrors
      });
    }

    // Determine if this is actually a group booking (more than 1 patient)
    const isActuallyGroup = patients.length > 1;
    const groupId = isActuallyGroup ? `GRP${Date.now()}${Math.floor(Math.random() * 1000)}` : null;
    
    // Create bookings for all patients with unique booking references
    const createdBookings = [];
    
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      
      // Generate a unique booking reference for each patient
      const bookingReference = await generateBookingReference(isActuallyGroup);
      
      // Calculate amount for this patient's tests
      const amount = await calculateTotalAmount(labId, patient.testIds);
      
      // Create appointment details from patient's appointmentDate
      const appointmentDetails = {
        preferredDate: new Date(patient.patientDetails.appointmentDate),
        addressForCollection: patient.patientDetails.address
      };
      
      const booking = new Booking({
        lab: labId,
        tests: patient.testIds,
        serviceCity: serviceCity || '',
        patientDetails: {
          name: patient.patientDetails.name,
          age: patient.patientDetails.age,
          gender: patient.patientDetails.gender,
          mobile: patient.patientDetails.mobile,
          email: patient.patientDetails.email.toLowerCase(),
          address: patient.patientDetails.address
        },
        appointmentDetails: appointmentDetails,
        bookingReference: bookingReference, // Unique for each patient
        groupBooking: isActuallyGroup,
        groupId: groupId, // Same group ID for all patients in a group, or null for single
        patientIndex: i + 1,
        totalPatients: patients.length,
        bookingStatus: 'confirmed',
        totalAmount: amount.discounted,
        originalAmount: amount.original,
        discountApplied: amount.discount,
        amountSaved: amount.saved,
        paymentStatus: 'pending'
      });

      const savedBooking = await booking.save();
      createdBookings.push(savedBooking);
    }

    console.log(`Created ${createdBookings.length} bookings with group ID: ${groupId}`);

    // Populate bookings with details
    const populatedBookings = await Booking.find({ groupId: groupId })
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description')
      .sort('patientIndex');

    // Format response
    const formattedBookings = populatedBookings.map(booking => ({
      bookingId: booking._id,
      bookingReference: booking.bookingReference, // Individual reference
      patientIndex: booking.patientIndex,
      patientDetails: {
        ...booking.patientDetails.toObject(),
        appointmentDate: booking.appointmentDetails.preferredDate
      },
      tests: booking.tests,
      totalAmount: booking.totalAmount,
      appointmentDetails: booking.appointmentDetails
    }));

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdBookings.length} bookings`,
      booking: {
        groupId: groupId, // Return group ID for reference
        lab: populatedBookings[0]?.lab,
        patientsCount: patients.length,
        bookings: formattedBookings,
        appointmentDetails: populatedBookings[0]?.appointmentDetails
      }
    });

  } catch (error) {
    console.error('Multiple booking creation error details:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors 
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Duplicate booking reference',
        details: 'Please try again'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// ✅ Single booking route
router.post('/', async (req, res) => {
  try {
    console.log('Booking request received:', req.body);
    
    const { labId, testIds, patientDetails, serviceCity } = req.body;

    // Validate required fields
    if (!labId || !testIds || !patientDetails) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { labId, testIds, patientDetails: !!patientDetails }
      });
    }

    // Validate lab exists
    const lab = await Lab.findById(labId);
    if (!lab) {
      console.log('Lab not found:', labId);
      return res.status(404).json({ error: 'Lab not found' });
    }

    // Validate tests exist
    const tests = await Test.find({ _id: { $in: testIds } });
    if (tests.length !== testIds.length) {
      console.log('Tests not found. Requested:', testIds, 'Found:', tests.map(t => t._id));
      return res.status(404).json({ 
        error: 'One or more tests not found',
        requested: testIds,
        found: tests.map(t => t._id)
      });
    }

    // Validate required patient fields (including appointmentDate)
    const requiredPatientFields = ['name', 'age', 'gender', 'mobile', 'email', 'address', 'appointmentDate'];
    const missingFields = requiredPatientFields.filter(field => !patientDetails[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing patient details',
        missingFields 
      });
    }

    // Calculate total amount
    const amount = await calculateTotalAmount(labId, testIds);

    // Create appointment details from patient's appointmentDate
    const appointmentDetails = {
      preferredDate: new Date(patientDetails.appointmentDate),
      addressForCollection: patientDetails.address
    };

    // Generate unique booking reference
    const bookingReference = await generateBookingReference(false);

    // Create booking
    const booking = new Booking({
      lab: labId,
      tests: testIds,
      serviceCity: serviceCity || '',
      patientDetails: {
        name: patientDetails.name,
        age: patientDetails.age,
        gender: patientDetails.gender,
        mobile: patientDetails.mobile,
        email: patientDetails.email.toLowerCase(),
        address: patientDetails.address
      },
      appointmentDetails: appointmentDetails,
      bookingReference: bookingReference,
      groupBooking: false,
      groupId: null,
      patientIndex: 1,
      totalPatients: 1,
      bookingStatus: 'confirmed',
      totalAmount: amount.discounted,
      originalAmount: amount.original,
      discountApplied: amount.discount,
      amountSaved: amount.saved,
      paymentStatus: 'pending'
    });

    const savedBooking = await booking.save();
    console.log('Booking saved:', savedBooking._id);

    // Populate booking with details
    const populatedBooking = await Booking.findById(savedBooking._id)
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description');

    // Format response
    const formattedBooking = {
      ...populatedBooking.toObject(),
      patientDetails: {
        ...populatedBooking.patientDetails.toObject(),
        appointmentDate: populatedBooking.appointmentDetails.preferredDate
      }
    };

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: formattedBooking,
      bookingId: savedBooking._id,
      bookingReference: savedBooking.bookingReference
    });

  } catch (error) {
    console.error('Booking creation error details:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors 
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'Duplicate booking reference',
        details: 'Please try again'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// ✅ Get all bookings in a group (by groupId)
router.get('/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const bookings = await Booking.find({ groupId: groupId })
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description')
      .sort('patientIndex');
    
    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ 
        error: 'No bookings found with this group ID' 
      });
    }
    
    // Format bookings
    const formattedBookings = bookings.map(booking => ({
      ...booking.toObject(),
      patientDetails: {
        ...booking.patientDetails.toObject(),
        appointmentDate: booking.appointmentDetails.preferredDate
      }
    }));
    
    res.status(200).json({
      success: true,
      groupId: groupId,
      patientsCount: bookings.length,
      bookings: formattedBookings
    });
    
  } catch (error) {
    console.error('Error fetching group bookings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bookings',
      details: error.message 
    });
  }
});

// ✅ Get booking by individual reference
router.get('/reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const booking = await Booking.findOne({ bookingReference: reference })
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description');
    
    if (!booking) {
      return res.status(404).json({ 
        error: 'No booking found with this reference' 
      });
    }
    
    // If it's a group booking, get all related bookings
    if (booking.groupBooking && booking.groupId) {
      const groupBookings = await Booking.find({ groupId: booking.groupId })
        .populate('lab', 'name logo branches address contact discount')
        .populate('tests', 'name price description')
        .sort('patientIndex');
      
      const formattedGroupBookings = groupBookings.map(b => ({
        ...b.toObject(),
        patientDetails: {
          ...b.patientDetails.toObject(),
          appointmentDate: b.appointmentDetails.preferredDate
        }
      }));
      
      return res.status(200).json({
        success: true,
        isGroupBooking: true,
        groupId: booking.groupId,
        patientsCount: groupBookings.length,
        bookings: formattedGroupBookings
      });
    }
    
    // Single booking
    const formattedBooking = {
      ...booking.toObject(),
      patientDetails: {
        ...booking.patientDetails.toObject(),
        appointmentDate: booking.appointmentDetails.preferredDate
      }
    };
    
    res.status(200).json({
      success: true,
      isGroupBooking: false,
      booking: formattedBooking
    });
    
  } catch (error) {
    console.error('Error fetching booking by reference:', error);
    res.status(500).json({ 
      error: 'Failed to fetch booking',
      details: error.message 
    });
  }
});

// ✅ Cancel a group booking
router.patch('/group/:groupId/cancel', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const result = await Booking.updateMany(
      { groupId: groupId },
      { 
        bookingStatus: 'cancelled',
        updatedAt: new Date()
      }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ 
        error: 'No bookings found with this group ID' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully cancelled ${result.modifiedCount} booking(s)`,
      cancelledCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error cancelling group bookings:', error);
    res.status(500).json({ 
      error: 'Failed to cancel bookings',
      details: error.message 
    });
  }
});

// ✅ Cancel a single booking
router.patch('/:bookingId/cancel', async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Support both MongoDB ID and Booking Reference
    const query = bookingId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: bookingId } 
      : { bookingReference: bookingId };

    const booking = await Booking.findOneAndUpdate(
      query,
      { 
        bookingStatus: 'cancelled',
        updatedAt: new Date()
      },
      { new: true }
    ).populate('lab').populate('tests');
    
    if (!booking) {
      return res.status(404).json({ 
        error: 'Booking not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking
    });
    
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ 
      error: 'Failed to cancel booking',
      details: error.message 
    });
  }
});

// ✅ Get booking statistics for a patient
router.get('/patient/:email/stats', async (req, res) => {
  try {
    const { email } = req.params;
    
    const stats = await Booking.aggregate([
      {
        $match: {
          'patientDetails.email': email.toLowerCase()
        }
      },
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const totalBookings = await Booking.countDocuments({
      'patientDetails.email': email.toLowerCase()
    });
    
    const upcomingBookings = await Booking.countDocuments({
      'patientDetails.email': email.toLowerCase(),
      bookingStatus: 'confirmed',
      'appointmentDetails.preferredDate': { $gte: new Date() }
    });
    
    res.status(200).json({
      success: true,
      stats: {
        total: totalBookings,
        upcoming: upcomingBookings,
        breakdown: stats
      }
    });
    
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch booking statistics',
      details: error.message 
    });
  }
});

router.get("/lab/:labId", async (req, res) => {
  try {

    const bookings = await Booking.find({ lab: req.params.labId })
      .populate("tests")
      .populate("lab");

    res.json(bookings);

  } catch (error) {
    res.status(500).json({ message: "Error fetching bookings" });
  }
});
// Add this after your cancel routes
router.patch('/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Support both MongoDB ID and Booking Reference
    const query = bookingId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: bookingId } 
      : { bookingReference: bookingId };

    const booking = await Booking.findOneAndUpdate(
      query,
      { bookingStatus: status, updatedAt: new Date() },
      { new: true }
    ).populate('tests').populate('lab');
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    res.json({ success: true, message: `Status updated to ${status}`, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Delete a booking record
router.delete("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Support both MongoDB ID and Booking Reference
    const query = bookingId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: bookingId } 
      : { bookingReference: bookingId };

    const booking = await Booking.findOneAndDelete(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking record not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking record deleted successfully"
    });

  } catch (error) {
    console.error("Delete booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message
    });
  }
});
// Add this to your existing testBookingRoutes.js file

// ✅ Update a booking (edit patient details or appointment)
router.patch('/:bookingId/update', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { patientDetails, appointmentDetails, notes } = req.body;

    // Support both MongoDB ID and Booking Reference
    const query = bookingId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: bookingId } 
      : { bookingReference: bookingId };

    // Find the booking
    const booking = await Booking.findOne(query);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }

    // Check if booking can be edited (only pending or confirmed)
    if (booking.bookingStatus !== 'pending' && booking.bookingStatus !== 'confirmed') {
      return res.status(400).json({ 
        success: false,
        error: `Cannot edit booking with status: ${booking.bookingStatus}. Only pending or confirmed bookings can be edited.`
      });
    }

    // Update patient details if provided
    if (patientDetails) {
      booking.patientDetails = {
        ...booking.patientDetails.toObject(),
        name: patientDetails.name || booking.patientDetails.name,
        email: patientDetails.email || booking.patientDetails.email,
        mobile: patientDetails.mobile || booking.patientDetails.mobile,
        address: patientDetails.address || booking.patientDetails.address,
        age: patientDetails.age || booking.patientDetails.age,
        gender: patientDetails.gender || booking.patientDetails.gender
      };
    }

    // Update appointment details if provided
    if (appointmentDetails) {
      booking.appointmentDetails = {
        ...booking.appointmentDetails.toObject(),
        preferredDate: appointmentDetails.preferredDate || booking.appointmentDetails.preferredDate,
        addressForCollection: appointmentDetails.addressForCollection || booking.appointmentDetails.addressForCollection
      };
    }

    // Update notes if provided
    if (notes !== undefined) {
      booking.notes = notes;
    }

    booking.updatedAt = new Date();
    await booking.save();

    // Return updated booking with populated fields
    const updatedBooking = await Booking.findOne(query)
      .populate('lab', 'name logo branches address contact discount')
      .populate('tests', 'name price description');

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update booking',
      details: error.message 
    });
  }
});
export default router;