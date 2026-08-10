import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: false
  },
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true
  },
  
  // Report Details
  reportNumber: {
    type: String,
    unique: true
  },
  reportType: {
    type: String,
    enum: ['pdf', 'image', 'file', 'url'],
    default: 'pdf'
  },
  reportFile: {
    filename: String,
    originalName: String,
    path: String,
    url: String,
    size: Number,
    mimeType: String
  },
  
  // Report Content (for structured data)
  reportData: {
    parameters: [{
      name: String,
      value: String,
      unit: String,
      referenceRange: String,
      isAbnormal: Boolean
    }],
    summary: String,
    recommendations: String
  },
  
  // Dates
  reportDate: {
    type: Date,
    default: Date.now
  },
  testDate: Date,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired', 'draft'],
    default: 'pending'
  },
  
  // Verification
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  verificationNotes: String,
  
  // Additional Info
  remarks: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Sharing
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    email: String,
    sharedAt: Date
  }],
  
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

// Generate report number before saving
reportSchema.pre('save', async function(next) {
  if (!this.reportNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    // Add a random string component to prevent duplicate key errors
    const count = await this.constructor.countDocuments();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.reportNumber = `RPT${year}${month}${(count + 1).toString().padStart(4, '0')}${randomSuffix}`;
  }
  next();
});

// Indexes
reportSchema.index({ reportNumber: 1 });
reportSchema.index({ patientId: 1, status: 1 });
reportSchema.index({ bookingId: 1 });

export default mongoose.model('Report', reportSchema);