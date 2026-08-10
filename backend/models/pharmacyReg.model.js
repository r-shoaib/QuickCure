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

const pharmacyRegistrationSchema = new mongoose.Schema({
  // Step 1: Pharmacy Details
  pharmacyName: {
    type: String,
    required: [true, 'Pharmacy name is required'],
    trim: true,
    minlength: [3, 'Pharmacy name must be at least 3 characters'],
    maxlength: [100, 'Pharmacy name cannot exceed 100 characters']
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^\d{5}-[A-Z]\/\d{2}$/, 'Invalid license number format (Example: 23269-A/20)']
  },
  pharmacyType: {
    type: String,
    required: [true, 'Pharmacy type is required'],
    enum: ['retail', 'hospital', 'chain', 'independent', 'compounding', 'online']
  },
  licenseExpiry: {
    type: Date,
    required: [true, 'License expiry date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'License expiry date must be in the future'
    }
  },
  yearEstablished: {
    type: Number,
    required: [true, 'Year established is required'],
    min: [1900, 'Year must be 1900 or later'],
    max: [new Date().getFullYear(), 'Year cannot be in the future']
  },
  
  // Step 2: Contact Information
  ownerName: {
    type: String,
    required: [true, 'Owner name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  ownerCnic: {
    type: String,
    required: [true, 'Owner CNIC is required'],
    trim: true,
    match: [/^\d{5}-\d{7}-\d{1}$/, 'Invalid CNIC format (Example: 12345-1234567-1)'],
    unique: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^3[0-9]{9}$/, 'Enter a valid Pakistani phone number (3XXXXXXXXX)'],
    minlength: [10, 'Phone number must be 10 digits'],
    maxlength: [10, 'Phone number must be 10 digits']
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
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    minlength: [10, 'Address must be at least 10 characters'],
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  latitude: {
    type: Number,
    default: 24.8607
  },
  longitude: {
    type: Number,
    default: 67.0011
  },
  
  // Step 4: Documents
  licenseFile: documentSchema,
  taxCertificate: documentSchema,
  ownerIdProof: documentSchema,
  
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
pharmacyRegistrationSchema.index({ email: 1 });
pharmacyRegistrationSchema.index({ licenseNumber: 1 });
pharmacyRegistrationSchema.index({ ownerCnic: 1 });
pharmacyRegistrationSchema.index({ status: 1 });
pharmacyRegistrationSchema.index({ submittedAt: -1 });

// Virtual for formatted phone number
pharmacyRegistrationSchema.virtual('formattedPhone').get(function() {
  return `+92 ${this.phone}`;
});

// Virtual for formatted CNIC
pharmacyRegistrationSchema.virtual('formattedCnic').get(function() {
  if (!this.ownerCnic) return '';
  const parts = this.ownerCnic.split('-');
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
});

const PharmacyRegistration = mongoose.model('PharmacyRegistration', pharmacyRegistrationSchema);

export default PharmacyRegistration;