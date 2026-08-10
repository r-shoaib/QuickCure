
//-------------------UpdaTED BACKEND with new frontend-------------------
//models/doctorRegistration.model.js
import mongoose from 'mongoose';

const doctorRegistrationSchema = new mongoose.Schema({
  // Personal Information
  fullName: { 
    type: String, 
    required: [true, 'Full name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true
  },
  phone: { 
    type: String, 
    required: [true, 'Phone number is required'] 
  },
  gender: { 
    type: String, 
    required: [true, 'Gender is required'], 
    enum: ['Male', 'Female'] 
  },
  dob: { 
    type: Date, 
    required: [true, 'Date of birth is required'] 
  },
  cnic: { 
    type: String, 
    required: [true, 'CNIC is required'], 
    unique: true 
  },
  address: { 
    type: String, 
    required: [true, 'Address is required'] 
  },
  city: { 
    type: String, 
    required: [true, 'City is required'] 
  },
  country: { 
    type: String, 
    required: [true, 'Country is required'], 
    default: 'Pakistan' 
  },
  profilePicture: { 
    type: String, 
    required: [true, 'Profile picture is required'] 
  },

  // Education Information
  qualification: { 
    type: String, 
    required: [true, 'Qualification is required'] 
  },
  specialization: { 
    type: String, 
    required: [true, 'Specialization is required'] 
  },
  institute: { 
    type: String, 
    required: [true, 'Institute is required'] 
  },
  passingYear: { 
    type: Date, 
    required: [true, 'Passing year is required'] 
  },

  // Professional Information
  experienceYears: { 
    type: String, 
    required: [true, 'Experience is required'] 
  },
  currentHospital: { 
    type: String, 
    required: [true, 'Current hospital is required'] 
  },
  designation: { 
    type: String, 
    required: [true, 'Designation is required'] 
  },
  licenseNumber: { 
    type: String, 
    required: [true, 'License number is required'], 
    unique: true 
  },

  // Documents
  idCardFront: { 
    type: String, 
    required: [true, 'ID card front is required'] 
  },
  idCardBack: { 
    type: String, 
    required: [true, 'ID card back is required'] 
  },
  doctorLicense: { 
    type: String, 
    required: [true, 'Doctor license is required'] 
  },
  mbbsCertificate: { 
    type: String, 
    required: [true, 'MBBS certificate is required'] 
  },
  houseJobCertificate: { 
    type: String 
  },
  specializationCertificate: { 
    type: String 
  },
  fcpsCertificate: { 
    type: String 
  },

  // Registration Status
  registrationStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending' 
  },
  registrationNumber: { 
    type: String, 
    unique: true 
  },
  registrationDate: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Generate registration number before saving
doctorRegistrationSchema.pre('save', async function(next) {
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('DoctorRegistration').countDocuments();
    this.registrationNumber = `DOC-${year}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

// Index for search
doctorRegistrationSchema.index({ 
  email: 1, 
  cnic: 1, 
  licenseNumber: 1,
  registrationNumber: 1 
});

const DoctorRegistration = mongoose.model('DoctorRegistration', doctorRegistrationSchema);
export default DoctorRegistration;