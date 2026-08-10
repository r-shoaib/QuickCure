import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  startTime: { 
    type: String, 
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format validation
  },
  endTime: { 
    type: String, 
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format validation
  },
  isAvailable: { 
    type: Boolean, 
    default: true 
  }
}, { _id: false });

const doctorSchema = new mongoose.Schema({
    user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true
  },
  
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  qualification: { 
    type: String,
    trim: true 
  },
  experience: { 
    type: String,
    trim: true 
  },
  rating: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5 
  },
  totalReviews: { 
    type: Number, 
    default: 0 
  },
  image: { 
    type: String,
    default: null 
  },
  fee: {
    type: Number,
    required: true,
    min: 0
  },
  services: [{ 
    type: String,
    trim: true 
  }],
  availability: [availabilitySchema],
  speciality: { 
    type: String, 
    required: true,
    trim: true 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
doctorSchema.index({ speciality: 1, isActive: 1 });
doctorSchema.index({ rating: -1 });
doctorSchema.index({ fee: 1 });

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;