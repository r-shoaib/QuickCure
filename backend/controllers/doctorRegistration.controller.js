
import DoctorRegistration from '../models/doctorRegistration.model.js';
import Doctor from '../models/doctors.model.js';
import User from '../models/user.model.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { transporter } from '../config/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if CNIC exists
export const checkCNICExists = async (req, res) => {
  try {
    const { cnic } = req.params;
    
    // Validate CNIC format
    if (!cnic || !/^\d{13}$/.test(cnic)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CNIC format'
      });
    }

    const existingDoctor = await DoctorRegistration.findOne({ cnic });
    
    res.json({
      success: true,
      exists: !!existingDoctor,
      message: existingDoctor ? 'CNIC already registered' : 'CNIC available'
    });
  } catch (error) {
    console.error('CNIC check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking CNIC'
    });
  }
};

// Check if License Number exists
export const checkLicenseExists = async (req, res) => {
  try {
    const { licenseNumber } = req.params;
    
    // Validate license number format (5 digits followed by P, S, or D)
    const licensePattern = /^\d{5}-[PSD]$/;
    if (!licenseNumber || !licensePattern.test(licenseNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid license number format'
      });
    }

    const existingDoctor = await DoctorRegistration.findOne({ licenseNumber });
    
    res.json({
      success: true,
      exists: !!existingDoctor,
      message: existingDoctor ? 'License number already registered' : 'License number available'
    });
  } catch (error) {
    console.error('License check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking license number'
    });
  }
};

// Register new doctor
export const registerDoctor = async (req, res) => {
  try {
    const {
      fullName, email, phone, gender, dob, cnic, address,
      city, country, qualification, specialization, institute,
      passingYear, experienceYears, currentHospital, designation,
      licenseNumber
    } = req.body;

    // Check if already registered
    const existingRegistration = await DoctorRegistration.findOne({ 
      $or: [{ email }, { cnic }, { licenseNumber }] 
    });
    
    if (existingRegistration) {
      return res.status(400).json({ 
        success: false, 
        message: 'Doctor already registered with this email, CNIC or license number' 
      });
    }

    // Check required files
    if (!req.files || !req.files.profilePicture || !req.files.idCardFront || 
        !req.files.idCardBack || !req.files.doctorLicense || !req.files.mbbsCertificate) {
      return res.status(400).json({ 
        success: false, 
        message: 'All required documents must be uploaded' 
      });
    }

    // Get relative paths for files
    const getRelativePath = (file) => {
      return `doctor_profiles/${file.filename}`;
    };

    // Create new registration
    const newRegistration = new DoctorRegistration({
      fullName, email, phone, gender, dob, cnic, address, city, country,
      profilePicture: getRelativePath(req.files.profilePicture[0]),
      qualification, specialization, institute, passingYear,
      experienceYears, currentHospital, designation, licenseNumber,
      idCardFront: getRelativePath(req.files.idCardFront[0]),
      idCardBack: getRelativePath(req.files.idCardBack[0]),
      doctorLicense: getRelativePath(req.files.doctorLicense[0]),
      mbbsCertificate: getRelativePath(req.files.mbbsCertificate[0]),
      houseJobCertificate: req.files.houseJobCertificate ? 
        getRelativePath(req.files.houseJobCertificate[0]) : undefined,
      specializationCertificate: req.files.specializationCertificate ? 
        getRelativePath(req.files.specializationCertificate[0]) : undefined,
      fcpsCertificate: req.files.fcpsCertificate ? 
        getRelativePath(req.files.fcpsCertificate[0]) : undefined,
    });

    await newRegistration.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please wait for verification.',
      data: {
        registrationNumber: newRegistration.registrationNumber,
        fullName: newRegistration.fullName,
        email: newRegistration.email,
        registrationStatus: newRegistration.registrationStatus
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed. Please try again.' 
    });
  }
};

// Get all registrations
export const getAllRegistrations = async (req, res) => {
  try {
    const registrations = await DoctorRegistration.find()
      .select('-__v')
      .sort({ registrationDate: -1 });
    
    res.json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching registrations' 
    });
  }
};

// Get single registration by ID
export const getRegistrationById = async (req, res) => {
  try {
    const registration = await DoctorRegistration.findById(req.params.id).select('-__v');
    
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
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching registration' 
    });
  }
};

// Check registration status
export const checkRegistrationStatus = async (req, res) => {
  try {
    const { email, cnic } = req.query;
    
    const query = {};
    if (email) query.email = email;
    if (cnic) query.cnic = cnic;

    const registration = await DoctorRegistration.findOne(query)
      .select('fullName email registrationNumber registrationStatus');

    if (!registration) {
      return res.status(404).json({ 
        success: false, 
        message: 'No registration found' 
      });
    }

    res.json({
      success: true,
      data: {
        fullName: registration.fullName,
        email: registration.email,
        registrationNumber: registration.registrationNumber,
        registrationStatus: registration.registrationStatus
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error checking registration status' 
    });
  }
};

// Update registration status (for admin)
export const updateRegistrationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    const registration = await DoctorRegistration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ 
        success: false, 
        message: 'Registration not found' 
      });
    }

    // Auto-create the Doctor record when approved
    let createdDoctor = null;
    if (status === 'approved') {
      try {
        // Find the user to link to this doctor record
        const doctorUser = await User.findOne({ email: registration.email.toLowerCase() });
        
        const doctorPayload = {
          name: registration.fullName,
          speciality: registration.specialization || 'General Physician',
          qualification: registration.qualification || '',
          experience: registration.experienceYears ? `${registration.experienceYears} years` : '',
          fee: 500,
          isActive: true,
          email: registration.email,
          phone: registration.phone,
          city: registration.city,
          address: registration.address,
          licenseNumber: registration.licenseNumber,
          user: doctorUser ? doctorUser._id : undefined
        };

        createdDoctor = await Doctor.create(doctorPayload);
        console.log(`Doctor record auto-created from registration ${registration._id}: ${createdDoctor._id}`);
      } catch (docError) {
        console.error('Error auto-creating doctor record:', docError);
      }
    }

    // Update user role to 'doctor' when approved
    if (status === 'approved' && registration.email) {
      try {
        const user = await User.findOne({ email: registration.email.toLowerCase() });
        if (user) {
          user.role = 'doctor';
          if (createdDoctor) {
            user.doctorId = createdDoctor._id;
          }
          await user.save();
          console.log(`User ${registration.email} role updated to doctor`);
        } else {
          console.log(`No user found with email ${registration.email} to update role`);
        }
      } catch (userErr) {
        console.error('Error updating user role:', userErr);
      }
    }

    registration.registrationStatus = status;
    await registration.save();

    // Send confirmation email on approval
    if (status === 'approved' && registration.email) {
      try {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'QuickCure <noreply@quickcure.com>',
          to: registration.email,
          subject: 'Doctor Registration Approved - QuickCure',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #2c6774; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Registration Approved! ✅</h1>
              </div>
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <h2 style="color: #2c6774; margin-top: 0;">Welcome to QuickCure, Dr. ${registration.fullName}!</h2>
                <p style="color: #555; line-height: 1.6;">Dear Dr. ${registration.fullName},</p>
                <p style="color: #555; line-height: 1.6;">Congratulations! Your doctor registration has been <strong style="color: #28a745;">approved</strong> by our admin team.</p>
                <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
                  <p style="margin: 5px 0; color: #555;"><strong>Name:</strong> Dr. ${registration.fullName}</p>
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
      message: `Registration ${status} successfully${createdDoctor ? ' and Doctor created' : ''}`,
      data: registration
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating registration status' 
    });
  }
};

// Delete registration
export const deleteRegistration = async (req, res) => {
  try {
    const registration = await DoctorRegistration.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ 
        success: false, 
        message: 'Registration not found' 
      });
    }

    // Delete associated files
    const filesToDelete = [
      registration.profilePicture,
      registration.idCardFront,
      registration.idCardBack,
      registration.doctorLicense,
      registration.mbbsCertificate,
      registration.houseJobCertificate,
      registration.specializationCertificate,
      registration.fcpsCertificate
    ].filter(file => file);

    filesToDelete.forEach(file => {
      const filePath = path.join(__dirname, '../uploads', file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await DoctorRegistration.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Registration deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting registration' 
    });
  }
};

// Get statistics
export const getRegistrationStats = async (req, res) => {
  try {
    const total = await DoctorRegistration.countDocuments();
    const pending = await DoctorRegistration.countDocuments({ registrationStatus: 'pending' });
    const approved = await DoctorRegistration.countDocuments({ registrationStatus: 'approved' });
    const rejected = await DoctorRegistration.countDocuments({ registrationStatus: 'rejected' });

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching statistics' 
    });
  }
};