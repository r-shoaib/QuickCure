import User from "../models/user.model.js";
import Technician from "../models/technician.model.js";
import Booking from "../models/testBooking.models.js";
import SampleCollection from "../models/sampleCollection.model.js";
import { sendMail } from "../utils/sendMail.js";
import bcrypt from 'bcryptjs';

// POST /api/technician/login
export const technicianLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user with technician role
    const user = await User.findOne({ email, role: 'technician' }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or not a technician account'
      });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Get technician profile
    const technician = await Technician.findById(user.technicianId);
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician profile not found'
      });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        technicianId: technician._id,
        labId: technician.labId,
        availability: technician.availability
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/technician/dashboard
export const getTechnicianDashboard = async (req, res) => {
  try {
    const technicianId = req.user.technicianId;
    
    // Get today's assignments
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todaysBookings = await Booking.find({
      assignedTechnician: technicianId,
      assignedAt: { $gte: todayStart, $lte: todayEnd },
      bookingStatus: { $in: ['assigned', 'sample_collected', 'in_lab', 'report_ready'] }
    })
    .populate('tests', 'name')
    .populate('lab', 'name')
    .sort({ assignedAt: 1 });
    
    // Get upcoming assignments (next 7 days)
    const upcomingBookings = await Booking.find({
      assignedTechnician: technicianId,
      bookingStatus: { $nin: ['delivered', 'cancelled'] },
      appointmentDetails: { $exists: true }
    })
    .populate('tests', 'name')
    .populate('lab', 'name')
    .sort({ 'appointmentDetails.preferredDate': 1 })
    .limit(20);
    
    // Get completed tasks (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const completedBookings = await Booking.find({
      assignedTechnician: technicianId,
      bookingStatus: 'delivered',
      deliveredAt: { $gte: thirtyDaysAgo }
    })
    .populate('tests', 'name')
    .sort({ deliveredAt: -1 })
    .limit(50);
    
    // Calculate stats
    const stats = {
      today: todaysBookings.length,
      todayRemaining: 6 - todaysBookings.length,
      upcoming: upcomingBookings.length,
      completed: completedBookings.length,
      monthlyTotal: completedBookings.length
    };
    
    res.json({
      success: true,
      stats,
      todaysBookings,
      upcomingBookings,
      completedBookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/technician/booking/:bookingId/status
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, notes } = req.body;
    const technicianId = req.user.technicianId;
    
    // Verify booking is assigned to this technician
    const booking = await Booking.findOne({
      _id: bookingId,
      assignedTechnician: technicianId
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not assigned to you'
      });
    }
    
    // Validate status transition
    const validTransitions = {
      'assigned': ['sample_collected'],
      'sample_collected': ['in_lab'],
      'in_lab': ['report_ready', 'delivered'],
      'report_ready': ['delivered']
    };
    
    const currentStatus = booking.bookingStatus;
    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${currentStatus} to ${status}`
      });
    }
    
    // Update booking
    const updateData = { bookingStatus: status };
    if (status === 'sample_collected') updateData.sampleCollectedAt = new Date();
    if (status === 'in_lab') updateData.receivedInLabAt = new Date();
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      
      // Free up technician
      await Technician.findByIdAndUpdate(technicianId, {
        $pull: { assignedBookings: bookingId },
        availability: 'available'
      });
    }
    
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true }
    );
    
    // Update sample collection if exists
    if (status === 'sample_collected') {
      await SampleCollection.findOneAndUpdate(
        { bookingId },
        { 
          status: 'collected', 
          collectedAt: new Date(),
          collectedBy: technicianId,
          notes: notes
        }
      );
    } else if (status === 'in_lab') {
      await SampleCollection.findOneAndUpdate(
        { bookingId },
        { status: 'delivered', deliveredAt: new Date() }
      );
    }
    
    res.json({
      success: true,
      message: 'Status updated successfully',
      booking: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/technician/booking/:bookingId/notify-admin
export const notifyLabAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { message, priority } = req.body;
    const technicianId = req.user.technicianId;
    
    // Get booking details
    const booking = await Booking.findById(bookingId)
      .populate('lab', 'name')
      .populate('patientDetails', 'name mobile');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Get technician details
    const technician = await Technician.findById(technicianId);
    
    // Get lab admin users
    const labAdmins = await User.find({
      role: 'admin',
      labId: booking.lab._id
    });
    
    // Send email to lab admin
    for (const admin of labAdmins) {
      if (admin.email) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2c6774; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">🔬 Sample Collection Update</h2>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0;">
              <p><strong>Technician:</strong> ${technician.name}</p>
              <p><strong>Patient:</strong> ${booking.patientDetails?.name || 'Patient'}</p>
              <p><strong>Status:</strong> ${booking.bookingStatus}</p>
              <p><strong>Message:</strong> ${message || 'Status updated'}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `;
        
        await sendMail(
          admin.email,
          `Sample Collection Update - ${booking.patientDetails?.name || 'Patient'}`,
          emailHtml
        );
      }
    }
    
    res.json({
      success: true,
      message: 'Lab admin notified successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/technician/profile
export const getTechnicianProfile = async (req, res) => {
  try {
    const technician = await Technician.findById(req.user.technicianId)
      .populate('labId', 'name');
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician profile not found'
      });
    }
    
    res.json({
      success: true,
      technician
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/technician/profile
export const updateTechnicianProfile = async (req, res) => {
  try {
    const { phone, city, availability } = req.body;
    
    const technician = await Technician.findByIdAndUpdate(
      req.user.technicianId,
      { phone, city, availability },
      { new: true }
    );
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        message: 'Technician profile not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      technician
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};