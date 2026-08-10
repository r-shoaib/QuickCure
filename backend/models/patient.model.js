import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  mobile: {
    type: String,
    required: true
  },
  age: Number,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  dateOfBirth: Date,
  
  // Contact Information
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },
  
  // Medical Information
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  allergies: [String],
  chronicConditions: [{
    condition: String,
    diagnosedYear: Number,
    medications: [String],
    notes: String
  }],
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    mobile: String
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Preferences
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: true },
    preferredLab: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' }
  },
  
  // Profile Image
  profilePicture: String,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
patientSchema.index({ email: 1 });
patientSchema.index({ mobile: 1 });
patientSchema.index({ name: 'text' });

export default mongoose.model('Patient', patientSchema);