import express from "express";
import multer from "multer";
import path from "path";
import Report from "../models/report.model.js";
import Booking from "../models/testBooking.models.js";
import Patient from "../models/patient.model.js";
import mongoose from "mongoose";
import fs from 'fs';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/reports/';
    // Ensure directory exists to prevent upload failure
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

// ==================== REPORT UPLOAD & MANAGEMENT ====================

// ✅ Upload report for a test
router.post('/upload', upload.single('reportFile'), async (req, res) => {
  try {
    let { 
      bookingId, 
      testId, 
      patientId, 
      labId,
      reportDate,
      testDate,
      remarks,
      reportData
    } = req.body;
    
    if (!bookingId || !testId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and testId are required'
      });
    }

    // Validate testId format to prevent CastError
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid testId format'
      });
    }

    // Support both MongoDB ID and Booking Reference for resolution
    const bookingQuery = (typeof bookingId === 'string' && bookingId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: bookingId } 
      : { bookingReference: bookingId };

    // Verify booking exists
    const booking = await Booking.findOne(bookingQuery).populate('tests');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    const actualBookingId = booking._id;

    const reportFile = req.file;
    
    if (!reportFile && !reportData) {
      return res.status(400).json({
        success: false,
        message: 'Either report file or report data is required'
      });
    }
    
    // Check if report already exists
    const existingReport = await Report.findOne({
      bookingId: actualBookingId,
      testId,
      status: { $ne: 'rejected' }
    });
    
    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'Report already exists for this test',
        data: existingReport
      });
    }

    // Sanitize patientId - ensure it is a valid ObjectId or null
    let resolvedPatientId = (patientId && mongoose.Types.ObjectId.isValid(patientId)) ? patientId : null;

    // Auto-resolve or Auto-register patient to ensure visibility across dashboard
    if (booking.patientDetails?.email) {
      try {
        let foundPatient = await Patient.findOne({ 
          email: booking.patientDetails.email.toLowerCase() 
        });

        if (!foundPatient) {
          // Create patient profile automatically using booking details
          // Ensure gender matches enum: ['male', 'female', 'other']
          const sanitizedGender = ['male', 'female', 'other'].includes(booking.patientDetails.gender?.toLowerCase()) 
            ? booking.patientDetails.gender.toLowerCase() 
            : 'other';

          foundPatient = new Patient({
            name: booking.patientDetails.name,
            email: booking.patientDetails.email.toLowerCase(),
            mobile: booking.patientDetails.mobile,
            age: booking.patientDetails.age,
            gender: sanitizedGender,
            address: { street: booking.patientDetails.address }
          });
          await foundPatient.save();
        }
        resolvedPatientId = foundPatient._id;
      } catch (pErr) {
        console.error("Non-critical patient resolution failure:", pErr);
        // Continue upload even if patient profile creation fails
      }
    }

    // Use labId from booking if not provided
    const finalLabId = labId || booking.lab;
    
    // Create report
    const report = new Report({
      bookingId: actualBookingId,
      testId,
      patientId: resolvedPatientId,
      labId: finalLabId,
      reportDate: reportDate || new Date(),
      testDate: testDate || booking.appointmentDetails.preferredDate,
      remarks,
      status: 'pending',
      uploadedBy: req.user?._id
    });
    
    if (reportFile) {
      report.reportFile = {
        filename: reportFile.filename,
        originalName: reportFile.originalname,
        path: reportFile.path,
        url: `/uploads/reports/${reportFile.filename}`,
        size: reportFile.size,
        mimeType: reportFile.mimetype
      };
    }
    
    if (reportData) {
      try {
        // Handle both stringified JSON and direct objects
        report.reportData = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
      } catch (e) {
        console.error("Failed to parse reportData:", e);
      }
    }
    
    await report.save();
    
    // Update booking status if all tests now have reports
    // This ensures the booking shows as 'Completed' in all dashboard stats
    const totalReportsUploaded = await Report.countDocuments({
      bookingId: actualBookingId,
      status: { $ne: 'rejected' }
    });
    
    const totalTestsInBooking = booking.tests?.length || 0;
    if (totalReportsUploaded >= totalTestsInBooking && totalTestsInBooking > 0) {
      booking.bookingStatus = 'completed';
      await booking.save();
    }
    
    res.status(201).json({
      success: true,
      message: 'Report uploaded successfully',
      data: report
    });
    
  } catch (error) {
    console.error('Error uploading report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload report',
      details: error.message
    });
  }
});

// ✅ Get reports for a patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, fromDate, toDate, testId } = req.query;
    
    const query = { patientId };
    if (status) query.status = status;
    if (testId) query.testId = testId;
    if (fromDate || toDate) {
      query.reportDate = {};
      if (fromDate) query.reportDate.$gte = new Date(fromDate);
      if (toDate) query.reportDate.$lte = new Date(toDate);
    }
    
    const reports = await Report.find(query)
      .populate('testId', 'name price description category')
      .populate('labId', 'name address contact')
      .populate('bookingId', 'bookingReference appointmentDetails')
      .sort('-reportDate');
    
    // Group by test category
    const groupedByCategory = reports.reduce((acc, report) => {
      const category = report.testId?.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(report);
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      count: reports.length,
      groupedByCategory,
      data: reports
    });
    
  } catch (error) {
    console.error('Error fetching patient reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
});

// ✅ Get reports for a booking (with missing tests tracking)
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .populate('tests', 'name price description')
      .populate('lab', 'name');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    const reports = await Report.find({ bookingId })
      .populate('testId', 'name category')
      .populate('labId', 'name')
      .populate('patientId', 'name') // Add patient population
      .sort('-createdAt');
    
    // Find which tests have reports and which are missing
    const reportedTestIds = reports
      .filter(r => r.testId)
      .map(r => r.testId._id.toString());

    const missingTests = (booking.tests || []).filter(test => 
      !reportedTestIds.includes(test._id.toString())
    );
    
    const completionPercentage = (reports.length / booking.tests.length) * 100;
    
    res.status(200).json({
      success: true,
      booking: {
        id: booking._id,
        reference: booking.bookingReference,
        lab: booking.lab,
        totalTests: booking.tests?.length || 0,
        appointmentDate: booking.appointmentDetails.preferredDate
      },
      reports: reports,
      missingTests: missingTests,
      completionPercentage: Math.round(completionPercentage),
      isComplete: reports.length === booking.tests.length
    });
    
  } catch (error) {
    console.error('Error fetching booking reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
});

// ✅ Get single report by ID
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await Report.findById(reportId)
      .populate('testId', 'name price description category')
      .populate('labId', 'name address contact')
      .populate('bookingId', 'bookingReference');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report',
      details: error.message
    });
  }
});

// ✅ Verify/Approve report (Lab/Admin only)
router.patch('/:reportId/verify', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, verificationNotes } = req.body;
    
    const report = await Report.findByIdAndUpdate(
      reportId,
      {
        status: status,
        verifiedBy: req.user?._id,
        verifiedAt: new Date(),
        verificationNotes: verificationNotes
      },
      { new: true }
    );
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    // If report is approved, check if all reports for this booking are ready
    if (status === 'approved') {
      const booking = await Booking.findById(report.bookingId);
      const approvedReports = await Report.countDocuments({
        bookingId: report.bookingId,
        status: 'approved'
      });
      
      if (approvedReports === booking.tests.length) {
        booking.bookingStatus = 'completed';
        await booking.save();
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Report ${status} successfully`,
      data: report
    });
    
  } catch (error) {
    console.error('Error verifying report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify report',
      details: error.message
    });
  }
});

// ✅ Share report via email
router.post('/:reportId/share', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { email, message } = req.body;
    
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    report.isShared = true;
    report.sharedWith.push({
      email: email,
      sharedAt: new Date()
    });
    await report.save();
    
    // Here you can implement email sending logic
    // await sendReportEmail(email, report, message);
    
    res.status(200).json({
      success: true,
      message: `Report shared with ${email}`
    });
    
  } catch (error) {
    console.error('Error sharing report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share report',
      details: error.message
    });
  }
});

// Add this route after your existing routes

// ✅ Get reports by lab ID
router.get('/lab/:labId', async (req, res) => {
  try {
    const { labId } = req.params;
    const { status, fromDate, toDate, testId } = req.query;
    
    const query = { labId };
    if (status) query.status = status;
    if (testId) query.testId = testId;
    if (fromDate || toDate) {
      query.reportDate = {};
      if (fromDate) query.reportDate.$gte = new Date(fromDate);
      if (toDate) query.reportDate.$lte = new Date(toDate);
    }
    
    const reports = await Report.find(query)
      .populate('testId', 'name price description category')
      .populate('patientId', 'name email mobile age gender')
      .populate('bookingId', 'bookingReference appointmentDetails patientDetails') // Add patientDetails here
      .sort('-reportDate');
    
    // Get statistics
    const stats = {
      total: reports.length,
      pending: reports.filter(r => r.status === 'pending').length,
      approved: reports.filter(r => r.status === 'approved').length,
      rejected: reports.filter(r => r.status === 'rejected').length,
      draft: reports.filter(r => r.status === 'draft').length
    };
    
    res.status(200).json({
      success: true,
      stats,
      data: reports
    });
    
  } catch (error) {
    console.error('Error fetching lab reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
});

// ✅ Delete a report
router.delete('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reportId format'
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const bookingId = report.bookingId;

    // 1. Physical file delete karein agar exist karti hai
    if (report.reportFile && report.reportFile.path) {
      const filePath = path.resolve(report.reportFile.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 2. Database se record delete karein
    await Report.findByIdAndDelete(reportId);

    // 3. Booking status update karein (agar pehle 'completed' thi toh wapas 'confirmed' karein)
    const booking = await Booking.findById(bookingId);
    if (booking && booking.bookingStatus === 'completed') {
      const remainingReports = await Report.countDocuments({ 
        bookingId, 
        status: { $ne: 'rejected' } 
      });
      
      if (remainingReports < (booking.tests?.length || 0)) {
        booking.bookingStatus = 'confirmed';
        await booking.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete report',
      details: error.message
    });
  }
});

export default router;