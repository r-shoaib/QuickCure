import mongoose from 'mongoose';
const bookingSchema = new mongoose.Schema({
  lab: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true }],
  serviceCity: { type: String, default: '' },
  patientDetails: {
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true }
  },
  appointmentDetails: {
    preferredDate: { type: Date, required: true },
    // sampleCollectionType removed
    addressForCollection: { type: String } // Optional
  },
  bookingReference: { type: String, required: true, unique: true },
  groupBooking: { type: Boolean, default: false },
  groupId: { type: String },
  patientIndex: { type: Number },
  totalPatients: { type: Number, default: 1 },
  bookingStatus: { 
    type: String, 
    enum: ['pending', 'confirmed', 'assigned', 'sample_collected', 'in_lab', 'report_ready', 'delivered', 'cancelled', 'completed'],
    default: 'pending'
  },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  assignedAt: { type: Date },
  sampleCollectedAt: { type: Date },
  receivedInLabAt: { type: Date },
  reportReadyAt: { type: Date },
  deliveredAt: { type: Date },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  totalAmount: { type: Number, required: true },
  originalAmount: { type: Number, required: true },
  discountApplied: { type: Number, default: 0 },
  amountSaved: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', bookingSchema);