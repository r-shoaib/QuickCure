import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  patientName: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true
  },
  patientAge: {
    type: Number
  },
  patientGender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  patientEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  patientPhone: {
    type: String,
    trim: true
  },
  medicines: [{
    name: { type: String, required: true },
    dosage: { type: String },
    frequency: { type: String },
    instructions: { type: String }
  }],
  diagnosis: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  fileUrl: {
    type: String,
    trim: true
  },
  prescribedDate: {
    type: Date,
    default: Date.now
  },
  followUpDate: {
    type: Date
  }
}, {
  timestamps: true
});

prescriptionSchema.index({ doctor: 1, prescribedDate: -1 });
prescriptionSchema.index({ patientPhone: 1 });

const Prescription = mongoose.model('Prescription', prescriptionSchema);

export default Prescription;