
import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  path: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const labRegistrationSchema = new mongoose.Schema({
  // Step 1: Basic Info
  labName: {
    type: String,
    required: [true, 'Lab name is required'],
    trim: true,
    minlength: [3, 'Lab name must be at least 3 characters'],
    maxlength: [100, 'Lab name cannot exceed 100 characters']
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{2,5}-?\d{4,8}$/, 'Invalid registration number format']
  },
  labType: {
    type: String,
    required: [true, 'Lab type is required'],
    enum: ['diagnostic', 'hospital', 'independent', 'specialized']
  },
  establishmentYear: {
    type: Number,
    required: [true, 'Establishment year is required'],
    min: [1900, 'Year must be 1900 or later'],
    max: [new Date().getFullYear(), 'Year cannot be in the future']
  },
  
  // Step 2: Contact Details
  contactPerson: {
    type: String,
    required: [true, 'Contact person is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    enum: ['Lab Director', 'Owner', 'Manager', 'Lab Technician', 'Pathologist', 'Administrator']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please enter a valid email']
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [/^3[0-9]{9}$/, 'Enter a valid Pakistani mobile number (3XXXXXXXXX)'],
    minlength: [10, 'Mobile number must be 10 digits'],
    maxlength: [10, 'Mobile number must be 10 digits']
  },
  
  // Step 3: Location
  province: {
    type: String,
    required: [true, 'Province is required'],
    enum: ['punjab', 'sindh', 'kpk', 'balochistan', 'islamabad', 'gilgit', 'ajk']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  completeAddress: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    minlength: [10, 'Address must be at least 10 characters'],
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  
  // Step 4: Documents
  registrationCertificate: documentSchema,
  cnicFront: documentSchema,
  cnicBack: documentSchema,
  
  // Step 5: Terms
  termsAccepted: {
    type: Boolean,
    required: true,
    default: false
  },
  commissionAgreed: {
    type: Boolean,
    required: true,
    default: false
  },
  
  // System fields
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  adminNotes: String
}, {
  timestamps: true
});

// Indexes for better query performance
labRegistrationSchema.index({ email: 1 });
labRegistrationSchema.index({ registrationNumber: 1 });
labRegistrationSchema.index({ status: 1 });
labRegistrationSchema.index({ submittedAt: -1 });

// Virtual for formatted mobile number
labRegistrationSchema.virtual('formattedMobile').get(function() {
  return `+92 ${this.mobileNumber}`;
});

const LabRegistration = mongoose.model('LabRegistration', labRegistrationSchema);

export default LabRegistration;