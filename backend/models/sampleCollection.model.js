import mongoose from 'mongoose';

const sampleCollectionSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
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
  
  // Schedule Details
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTimeSlot: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    lowercase: true,
    trim: true
  },
  
  // Collection Details
  collectionAddress: {
    type: String,
    required: true
  },
  collectionAddressDetails: {
    landmark: String,
    instructions: String
  },
  
  // Collector Information
  assignedCollector: {
    name: String,
    contact: String,
    employeeId: String
  },
  collectedBy: String,
  collectedByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  collectedAt: Date,
  
  // Sample Details
  samples: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test'
    },
    sampleType: {
      type: String,
      enum: ['blood', 'urine', 'stool', 'swab', 'other']
    },
    collectionMethod: String,
    containerType: String,
    quantity: String,
    isCollected: {
      type: Boolean,
      default: false
    }
  }],
  
  // Status Tracking
  status: {
    type: String,
    enum: ['scheduled', 'assigned', 'in_progress', 'collected', 'delivered', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  
  // Additional Info
  specialInstructions: String,
  patientCondition: String,
  fastingRequired: {
    type: Boolean,
    default: false
  },
  fastingHours: Number,
  
  // Timeline
  assignedAt: Date,
  startedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Tracking
  trackingId: String,
  notes: [{
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
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

// Generate tracking ID
sampleCollectionSchema.pre('save', async function(next) {
  if (!this.trackingId) {
    const date = new Date();
    const random = Math.floor(10000 + Math.random() * 90000);
    this.trackingId = `SMP${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${random}`;
  }
  next();
});

// Indexes
sampleCollectionSchema.index({ trackingId: 1 });
sampleCollectionSchema.index({ patientId: 1, status: 1 });
sampleCollectionSchema.index({ labId: 1, scheduledDate: 1 });

export default mongoose.model('SampleCollection', sampleCollectionSchema);