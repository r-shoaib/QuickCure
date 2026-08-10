import PharmacyRegistration from '../models/pharmacyReg.model.js';
import Pharmacy from '../models/Pharmacy.js';
import User from '../models/user.model.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { transporter } from '../config/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pakistan provinces and cities data
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
    
    const existing = await PharmacyRegistration.findOne({ 
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

// Check if license number exists
export const checkLicenseNumber = async (req, res) => {
  try {
    const { licenseNumber } = req.query;
    
    if (!licenseNumber) {
      return res.status(400).json({
        success: false,
        message: 'License number is required'
      });
    }
    
    const existing = await PharmacyRegistration.findOne({ 
      licenseNumber: licenseNumber.toUpperCase() 
    });
    
    res.json({
      success: true,
      exists: !!existing
    });
  } catch (error) {
    console.error('Error checking license number:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Check if CNIC exists
export const checkCnicExists = async (req, res) => {
  try {
    const { cnic } = req.query;
    
    if (!cnic) {
      return res.status(400).json({
        success: false,
        message: 'CNIC is required'
      });
    }
    
    const existing = await PharmacyRegistration.findOne({ 
      ownerCnic: cnic 
    });
    
    res.json({
      success: true,
      exists: !!existing
    });
  } catch (error) {
    console.error('Error checking CNIC:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
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

// Submit pharmacy registration
export const submitRegistration = async (req, res) => {
  try {
    const {
      pharmacyName,
      licenseNumber,
      pharmacyType,
      licenseExpiry,
      yearEstablished,
      ownerName,
      ownerCnic,
      email,
      phone,
      province,
      city,
      address,
      termsAccepted,
      commissionAgreed,
      latitude,
      longitude
    } = req.body;

    // Validate required fields
    if (!pharmacyName || !licenseNumber || !pharmacyType || !licenseExpiry || !yearEstablished ||
        !ownerName || !ownerCnic || !email || !phone ||
        !province || !city || !address) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Check if email already exists
    const existingEmail = await PharmacyRegistration.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if license number exists
    const existingLicense = await PharmacyRegistration.findOne({ 
      licenseNumber: licenseNumber.toUpperCase() 
    });
    
    if (existingLicense) {
      return res.status(409).json({
        success: false,
        message: 'License number already exists'
      });
    }

    // Check if CNIC exists
    const existingCnic = await PharmacyRegistration.findOne({ 
      ownerCnic: ownerCnic 
    });
    
    if (existingCnic) {
      return res.status(409).json({
        success: false,
        message: 'CNIC already registered with another pharmacy'
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
      if (req.files.licenseFile && req.files.licenseFile[0]) {
        const file = req.files.licenseFile[0];
        documents.licenseFile = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      }
      
      if (req.files.taxCertificate && req.files.taxCertificate[0]) {
        const file = req.files.taxCertificate[0];
        documents.taxCertificate = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      }
      
      if (req.files.ownerIdProof && req.files.ownerIdProof[0]) {
        const file = req.files.ownerIdProof[0];
        documents.ownerIdProof = {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      }
    }

    // Check if required files are uploaded
    if (!documents.licenseFile) {
      return res.status(400).json({
        success: false,
        message: 'License certificate is required'
      });
    }

    if (!documents.ownerIdProof) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID proof is required'
      });
    }

    // Create registration
    const registration = new PharmacyRegistration({
      pharmacyName,
      licenseNumber: licenseNumber.toUpperCase(),
      pharmacyType,
      licenseExpiry: new Date(licenseExpiry),
      yearEstablished: parseInt(yearEstablished),
      ownerName,
      ownerCnic,
      email: email.toLowerCase(),
      phone,
      province,
      city,
      address,
      latitude: latitude ? parseFloat(latitude) : 24.8607,
      longitude: longitude ? parseFloat(longitude) : 67.0011,
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
        pharmacyName: registration.pharmacyName,
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
      let message = '';
      if (field === 'email') message = 'Email already registered';
      else if (field === 'licenseNumber') message = 'License number already exists';
      else if (field === 'ownerCnic') message = 'CNIC already registered with another pharmacy';
      else message = 'Duplicate entry found';
      
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

    const registrations = await PharmacyRegistration.find(query)
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await PharmacyRegistration.countDocuments(query);

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
    
    const registration = await PharmacyRegistration.findById(id).select('-__v');
    
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

    const registration = await PharmacyRegistration.findById(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Auto-create the Pharmacy record when approved
    let createdPharmacy = null;
    if (status === 'approved') {
      try {
        // Find the user to link this pharmacy to
        const pharmacyUser = await User.findOne({ email: registration.email.toLowerCase() });

        const pharmacyData = {
          name: registration.pharmacyName,
          pharmacyName: registration.pharmacyName,
          ownerName: registration.ownerName,
          email: registration.email,
          phone: registration.phone,
          address: registration.address,
          city: registration.city,
          state: registration.province,
          licenseNumber: registration.licenseNumber,
          pharmacyType: registration.pharmacyType,
          yearEstablished: registration.yearEstablished,
          licenseExpiry: registration.licenseExpiry,
          userId: pharmacyUser ? pharmacyUser._id : undefined,
          location: {
            type: 'Point',
            coordinates: [
              registration.longitude || 67.0011,
              registration.latitude || 24.8607
            ]
          },
          status: 'approved',
          open: true,
          rating: 0,
          deliveryTime: '30-45 mins',
          services: ['Delivery', 'Prescription'],
          deliveryRadius: 5,
          deliveryFee: 100,
          deliverySettings: {
            baseDeliveryCharge: 50,
            perKmCharge: 10,
            freeDeliveryThreshold: 500,
            preparationTime: 15,
            averageDeliverySpeed: 20
          }
        };

        createdPharmacy = await Pharmacy.create(pharmacyData);
        console.log(`Pharmacy record auto-created from registration ${registration._id}: ${createdPharmacy._id}`);
      } catch (pharmError) {
        console.error('Error auto-creating pharmacy record:', pharmError);
        // Don't fail the approval - the registration is still approved
        // The admin can manually create the pharmacy later
      }
    }

    // Update user role to 'pharmacy' when approved
    if (status === 'approved' && registration.email) {
      try {
        const user = await User.findOne({ email: registration.email.toLowerCase() });
        if (user) {
          user.role = 'pharmacy';
          if (createdPharmacy) {
            user.pharmacyId = createdPharmacy._id;
          }
          await user.save();
          console.log(`User ${registration.email} role updated to pharmacy`);
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
          subject: 'Pharmacy Registration Approved - QuickCure',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #2c6774; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Registration Approved! ✅</h1>
              </div>
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <h2 style="color: #2c6774; margin-top: 0;">Welcome to QuickCure, ${registration.pharmacyName}!</h2>
                <p style="color: #555; line-height: 1.6;">Dear ${registration.ownerName},</p>
                <p style="color: #555; line-height: 1.6;">Congratulations! Your pharmacy registration has been <strong style="color: #28a745;">approved</strong> by our admin team.</p>
                <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
                  <p style="margin: 5px 0; color: #555;"><strong>Pharmacy Name:</strong> ${registration.pharmacyName}</p>
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
      message: `Registration ${status}${createdPharmacy ? ' and Pharmacy created successfully' : ''}`,
      data: {
        id: registration._id,
        status: registration.status,
        reviewedAt: registration.reviewedAt,
        pharmacyId: createdPharmacy ? createdPharmacy._id : null
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

// Delete registration (admin)
export const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = await PharmacyRegistration.findByIdAndDelete(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    // Delete associated uploaded files
    const docFields = ['licenseFile', 'taxCertificate', 'ownerIdProof'];
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

// Get statistics (admin)
export const getStats = async (req, res) => {
  try {
    const total = await PharmacyRegistration.countDocuments();
    const pending = await PharmacyRegistration.countDocuments({ status: 'pending' });
    const approved = await PharmacyRegistration.countDocuments({ status: 'approved' });
    const rejected = await PharmacyRegistration.countDocuments({ status: 'rejected' });

    const recentRegistrations = await PharmacyRegistration.find()
      .sort({ submittedAt: -1 })
      .limit(5)
      .select('pharmacyName city status submittedAt');

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