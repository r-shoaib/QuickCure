import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNo: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  age: {
    type: Number,
    min: 0,
    max: 120
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say']
  },
  date: {
    type: Date,
    required: true
  },
  timeSlot: {
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    }
  },
  reason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  fee: {
    type: Number,
    required: true
  },
  meetLink: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  bookedAt: {
    type: Date,
    default: Date.now
  },
  confirmationCode: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Generate unique confirmation code
appointmentSchema.pre('save', async function(next) {
  if (!this.confirmationCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let isUnique = false;
    let code = '';
    
    while (!isUnique) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Check if code already exists
      const existing = await mongoose.model("Appointment").findOne({ confirmationCode: code });
      if (!existing) {
        isUnique = true;
      }
    }
    this.confirmationCode = code;
  }
  next();
});

// Indexes for faster queries
appointmentSchema.index({ doctor: 1, date: 1, status: 1 });
appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ phoneNo: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ confirmationCode: 1 }, { unique: true, sparse: true });

// Compound index to prevent double booking
appointmentSchema.index(
  { 
    doctor: 1, 
    date: 1, 
    'timeSlot.startTime': 1, 
    'timeSlot.endTime': 1,
    status: { $in: ['pending', 'confirmed'] }
  },
  { 
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'confirmed'] }
    }
  }
);

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;