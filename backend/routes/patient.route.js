import express from "express";
import Patient from "../models/patient.model.js";
import Booking from "../models/testBooking.models.js";
import Report from "../models/report.model.js";
import SampleCollection from "../models/sampleCollection.model.js";

const router = express.Router();

// ==================== PATIENT REGISTRATION ====================

// Register a new patient (auto-create from booking)
router.post('/register', async (req, res) => {
  try {
    const { name, email, mobile, age, gender, address } = req.body;
    
    // Check if patient already exists
    let patient = await Patient.findOne({ 
      $or: [{ email: email.toLowerCase() }, { mobile: mobile }] 
    });
    
    if (patient) {
      return res.status(200).json({
        success: true,
        message: 'Patient already exists',
        data: patient,
        isNew: false
      });
    }
    
    // Create new patient
    patient = new Patient({
      name,
      email: email.toLowerCase(),
      mobile,
      age,
      gender,
      address: {
        street: address?.street,
        city: address?.city,
        state: address?.state,
        pincode: address?.pincode
      }
    });
    
    await patient.save();
    
    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: patient,
      isNew: true
    });
    
  } catch (error) {
    console.error('Error registering patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register patient',
      details: error.message
    });
  }
});

// ✅ Get patient by ID with complete history
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // Get all bookings
    const bookings = await Booking.find({ 
      'patientDetails.email': patient.email 
    })
    .populate('lab', 'name logo address contact')
    .populate('tests', 'name price description category')
    .sort('-createdAt');
    
    // Get all reports
    const reports = await Report.find({ patientId: patient._id })
      .populate('testId', 'name category')
      .populate('labId', 'name')
      .sort('-reportDate');
    
    // Get all sample collections
    const collections = await SampleCollection.find({ patientId: patient._id })
      .populate('bookingId', 'bookingReference')
      .populate('tests', 'name')
      .sort('-scheduledDate');
    
    // Calculate statistics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.bookingStatus === 'completed').length;
    const pendingReports = reports.filter(r => r.status === 'pending').length;
    const totalSpent = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const upcomingAppointments = bookings.filter(b => 
      b.bookingStatus === 'confirmed' && 
      new Date(b.appointmentDetails.preferredDate) > new Date()
    ).length;
    
    res.status(200).json({
      success: true,
      data: {
        profile: patient,
        stats: {
          totalBookings,
          completedBookings,
          pendingReports,
          totalSpent,
          upcomingAppointments
        },
        recentBookings: bookings.slice(0, 5),
        recentReports: reports.slice(0, 5),
        upcomingCollections: collections.filter(c => 
          c.status === 'scheduled' && new Date(c.scheduledDate) > new Date()
        )
      }
    });
    
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient data',
      details: error.message
    });
  }
});

// ✅ Get patient by email
router.get('/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const patient = await Patient.findOne({ email: email.toLowerCase() });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: patient
    });
    
  } catch (error) {
    console.error('Error fetching patient by email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient',
      details: error.message
    });
  }
});

// ✅ Update patient profile
router.put('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const updateData = req.body;
    
    // Support both MongoDB ID and Email (used by lab dashboard)
    const query = patientId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: patientId } 
      : { email: patientId.toLowerCase() };

    updateData.updatedAt = new Date();
    
    const updatedPatient = await Patient.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedPatient
    });
    
  } catch (error) {
    console.error('Error updating patient:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile number already in use by another patient'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

// ✅ Delete patient record
router.delete('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Support both MongoDB ID and Email (used by lab dashboard)
    const query = patientId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: patientId } 
      : { email: patientId.toLowerCase() };

    const deletedPatient = await Patient.findOneAndDelete(query);

    if (!deletedPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Patient record deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete patient record',
      details: error.message
    });
  }
});

// Get patients by lab ID
router.get('/lab/:labId', async (req, res) => {
  try {
    const { labId } = req.params;
    
    // Get all bookings for this lab to find patients
    // patientDetails is a sub-document inside Booking, not a separate reference
    const bookings = await Booking.find({ lab: labId });
    
    // Extract unique patients from bookings
    const patientMap = new Map();
    
    bookings.forEach(booking => {
      const patientEmail = booking.patientDetails.email;
      if (!patientMap.has(patientEmail)) {
        patientMap.set(patientEmail, {
          _id: patientEmail,
          name: booking.patientDetails.name,
          email: booking.patientDetails.email,
          mobile: booking.patientDetails.mobile,
          age: booking.patientDetails.age,
          gender: booking.patientDetails.gender,
          address: booking.patientDetails.address
        });
      }
    });
    
    const patients = Array.from(patientMap.values());
    
    res.status(200).json({
      success: true,
      data: patients
    });
    
  } catch (error) {
    console.error('Error fetching patients by lab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patients',
      details: error.message
    });
  }
});

// Get patient medical history
router.get('/:patientId/medical-history', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: patient.chronicConditions || []
    });
    
  } catch (error) {
    console.error('Error fetching medical history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical history',
      details: error.message
    });
  }
});
export default router;