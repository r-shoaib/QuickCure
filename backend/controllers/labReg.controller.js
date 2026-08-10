import LabRegistration from '../models/labReg.model.js';
import Lab from '../models/lab.model.js';
import User from '../models/user.model.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { transporter } from '../config/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pakistan provinces and cities data (matching frontend)
 export const PAKISTAN_DATA = {
  provinces: [
    { id: 'punjab', name: 'Punjab' },
    { id: 'sindh', name: 'Sindh' },
    { id: 'kpk', name: 'Khyber Pakhtunkhwa' },
    { id: 'balochistan', name: 'Balochistan' },
    { id: 'islamabad', name: 'Islamabad Capital Territory' },
    { id: 'gilgit', name: 'Gilgit-Baltistan' },
    { id: 'ajk', name: 'Azad Jammu & Kashmir' }
  ],
  cities: {
    punjab: ['Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Sialkot', 'Bahawalpur', 'Sargodha', 'Jhang', 'Sheikhupura'],
    sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Nawabshah', 'Mirpur Khas', 'Jacobabad', 'Shikarpur', 'Dadu', 'Tando Allahyar'],
    kpk: ['Peshawar', 'Mardan', 'Abbottabad', 'Swat', 'Kohat', 'Bannu', 'Dera Ismail Khan', 'Charsadda', 'Nowshera', 'Mingora'],
    balochistan: ['Quetta', 'Turbat', 'Khuzdar', 'Gwadar', 'Sibi', 'Zhob', 'Loralai', 'Dera Bugti', 'Chaman', 'Hub'],
    islamabad: ['Islamabad'],
    gilgit: ['Gilgit', 'Skardu', 'Hunza', 'Ghizer', 'Nagar', 'Ghanche', 'Astore', 'Diamer'],
    ajk: ['Muzaffarabad', 'Mirpur', 'Rawalakot', 'Kotli', 'Bhimber', 'Bagh', 'Hattian', 'Haveli']
  }
};

// Get all provinces
export const getProvinces = async (req, res) => {
  try {
    res.json({
      success: true,
      provinces: PAKISTAN_DATA.provinces
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load provinces'
    });
  }
};

// Get cities by province
export const getCitiesByProvince = async (req, res) => {
  try {
    const { provinceId } = req.params;
    
    const cities = PAKISTAN_DATA.cities[provinceId] || [];
    
    res.json({
      success: true,
      cities: cities.map((city, index) => ({
        id: `${provinceId}-${index}`,
        name: city
      }))
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load cities'
    });
  }
};

// Get all location data
export const getLocationData = async (req, res) => {
  try {
    res.json({
      success: true,
      provinces: PAKISTAN_DATA.provinces,
      cities: PAKISTAN_DATA.cities
    });
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load location data'
    });
  }
};

// Get existing emails for validation
export const getExistingEmails = async (req, res) => {
  try {
    const registrations = await LabRegistration.find({}, 'email');
    res.json({
      success: true,
      emails: registrations.map(item => item.email.toLowerCase())
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Check if email exists
export const checkEmailExists = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const existing = await LabRegistration.findOne({ 
      email: email.toLowerCase() 
    });
    
    res.json({
      success: true,
      exists: !!existing
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Check if registration number exists
export const checkRegistrationNumber = async (req, res) => {
  try {
    const { registrationNumber } = req.query;
    
    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Registration number is required'
      });
    }
    
    const existing = await LabRegistration.findOne({ 
      registrationNumber: registrationNumber.toUpperCase() 
    });
    
    res.json({
      success: true,
      exists: !!existing
    });
  } catch (error) {
    console.error('Error checking registration number:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Submit lab registration
export const submitRegistration = async (req, res) => {
  try {
    const {
      labName,
      registrationNumber,
      labType,
      establishmentYear,
      contactPerson,
      designation,
      email,
      mobileNumber,
      province,
      city,
      completeAddress,
      termsAccepted,
      commissionAgreed
    } = req.body;

    // Validate required fields
    if (!labName || !registrationNumber || !labType || !establishmentYear || 
        !contactPerson || !designation || !email || !mobileNumber ||
        !province || !city || !completeAddress) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Check if email already exists
    const existingEmail = await LabRegistration.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if registration number exists
    const existingRegNumber = await LabRegistration.findOne({ 
      registrationNumber: registrationNumber.toUpperCase() 
    });
    
    if (existingRegNumber) {
      return res.status(409).json({
        success: false,
        message: 'Registration number already exists'
      });
    }

    // Validate province
    if (!PAKISTAN_DATA.provinces.find(p => p.id === province)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province'
      });
    }

    // Validate city
    const validCities = PAKISTAN_DATA.cities[province] || [];
    if (!validCities.includes(city)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid city for selected province'
      });
    }

    // Prepare document objects
    const documents = {};
    
    if (req.files) {
      if (req.files.registrationCertificate && req.files.registrationCertificate[0]) {
        const file = req.files.registrationCertificate[0];
        documents.registrationCertificate = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      }
      
      if (req.files.cnicFront && req.files.cnicFront[0]) {
        const file = req.files.cnicFront[0];
        documents.cnicFront = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      }
      
      if (req.files.cnicBack && req.files.cnicBack[0]) {
        const file = req.files.cnicBack[0];
        documents.cnicBack = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      }
    }

    // Check if required files are uploaded
    if (!documents.registrationCertificate) {
      return res.status(400).json({
        success: false,
        message: 'Registration certificate is required'
      });
    }

    if (!documents.cnicFront) {
      return res.status(400).json({
        success: false,
        message: 'CNIC front is required'
      });
    }

    // Create registration
    const registration = new LabRegistration({
      labName,
      registrationNumber: registrationNumber.toUpperCase(),
      labType,
      establishmentYear: parseInt(establishmentYear),
      contactPerson,
      designation,
      email: email.toLowerCase(),
      mobileNumber,
      province,
      city,
      completeAddress,
      termsAccepted: termsAccepted === 'true' || termsAccepted === true,
      commissionAgreed: commissionAgreed === 'true' || commissionAgreed === true,
      ...documents
    });

    await registration.save();

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully! Admin will review within 24-48 hours.',
      data: {
        id: registration._id,
        labName: registration.labName,
        email: registration.email,
        status: registration.status,
        submittedAt: registration.submittedAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    // Delete uploaded files if registration fails
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        fileArray.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error('Error deleting file:', err);
          }
        });
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = field === 'email' 
        ? 'Email already registered' 
        : 'Registration number already exists';
      
      return res.status(409).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all registrations (admin)
export const getAllRegistrations = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const registrations = await LabRegistration.find(query)
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await LabRegistration.countDocuments(query);

    res.json({
      success: true,
      data: registrations,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get single registration by ID
export const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = await LabRegistration.findById(id).select('-__v');
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    res.json({
      success: true,
      data: registration
    });
    
  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete registration (admin)
export const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = await LabRegistration.findByIdAndDelete(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    // Delete associated uploaded files
    const docFields = ['registrationCertificate', 'cnicFront', 'cnicBack'];
    docFields.forEach(field => {
      if (registration[field] && registration[field].path) {
        try {
          fs.unlinkSync(registration[field].path);
        } catch (err) {
          console.error(`Error deleting file ${registration[field].path}:`, err);
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Registration deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update registration status (admin)
export const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const registration = await LabRegistration.findById(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Auto-create the Lab record when approved
    let createdLab = null;
    if (status === 'approved') {
      try {
        // Find the user to link this lab to
        const labUser = await User.findOne({ email: registration.email.toLowerCase() });

        const labData = {
          name: registration.labName,
          branches: registration.city || 'Main Branch',
          discount: 0,
          userId: labUser ? labUser._id : undefined
        };

        createdLab = await Lab.create(labData);
        console.log(`Lab record auto-created from registration ${registration._id}: ${createdLab._id}`);
      } catch (labError) {
        console.error('Error auto-creating lab record:', labError);
      }
    }

    // Update user role to 'lab' when approved
    if (status === 'approved' && registration.email) {
      try {
        const user = await User.findOne({ email: registration.email.toLowerCase() });
        if (user) {
          user.role = 'lab';
          if (createdLab) {
            user.labId = createdLab._id;
          }
          await user.save();
          console.log(`User ${registration.email} role updated to lab`);
        } else {
          console.log(`No user found with email ${registration.email} to update role`);
        }
      } catch (userErr) {
        console.error('Error updating user role:', userErr);
      }
    }

    registration.status = status;
    registration.adminNotes = adminNotes || '';
    registration.reviewedAt = new Date();

    await registration.save();

    // Send confirmation email on approval
    if (status === 'approved' && registration.email) {
      try {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5000';
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'QuickCure <noreply@quickcure.com>',
          to: registration.email,
          subject: 'Lab Registration Approved - QuickCure',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #2c6774; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Registration Approved! ✅</h1>
              </div>
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <h2 style="color: #2c6774; margin-top: 0;">Welcome to QuickCure, ${registration.labName}!</h2>
                <p style="color: #555; line-height: 1.6;">Dear ${registration.contactPerson},</p>
                <p style="color: #555; line-height: 1.6;">Congratulations! Your lab registration has been <strong style="color: #28a745;">approved</strong> by our admin team.</p>
                <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
                  <p style="margin: 5px 0; color: #555;"><strong>Lab Name:</strong> ${registration.labName}</p>
                  <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ${registration.email}</p>
                  <p style="margin: 5px 0; color: #555;"><strong>Status:</strong> <span style="color: #28a745;">Approved</span></p>
                </div>
                <p style="color: #555; line-height: 1.6;">You can now log in to your account and start offering your services on QuickCure.</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${clientUrl}/login" style="background: #2c6774; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">Login to QuickCure</a>
                </p>
                <p style="color: #888; font-size: 12px; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 15px;">
                  This is an automated message from QuickCure Healthcare System. Please do not reply to this email.
                </p>
              </div>
            </div>
          `
        });
        console.log(`Approval email sent to ${registration.email}`);
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
      }
    }

    res.json({
      success: true,
      message: `Registration ${status}`,
      data: {
        id: registration._id,
        status: registration.status,
        reviewedAt: registration.reviewedAt
      }
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get statistics (admin)
export const getStats = async (req, res) => {
  try {
    const total = await LabRegistration.countDocuments();
    const pending = await LabRegistration.countDocuments({ status: 'pending' });
    const approved = await LabRegistration.countDocuments({ status: 'approved' });
    const rejected = await LabRegistration.countDocuments({ status: 'rejected' });

    const recentRegistrations = await LabRegistration.find()
      .sort({ submittedAt: -1 })
      .limit(5)
      .select('labName city status submittedAt');

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        recentRegistrations
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};