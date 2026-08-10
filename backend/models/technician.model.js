import mongoose from 'mongoose';

const technicianSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  city: { type: String, required: true },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  isActive: { type: Boolean, default: true },
  availability: { type: String, enum: ['available', 'busy', 'offline'], default: 'available' },
  assignedBookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Technician', technicianSchema);