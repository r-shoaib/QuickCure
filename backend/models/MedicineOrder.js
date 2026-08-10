import mongoose from 'mongoose';

const medicineOrderSchema = new mongoose.Schema({
  // 🔥 CRITICAL: Yeh field properly defined hona chahiye
  orderId: { 
    type: String, 
    required: true,
    unique: true,
    default: function() {
      // Agar kisi ne orderId na di ho toh auto-generate karo
      return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    }
  },
  orderNumber: { 
    type: String, 
    required: true,
    unique: true 
  },
  patientInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    notes: { type: String, default: '' }
  },
  medicines: [{
    medicineId: { type: String },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    tabletQuantity: { type: Number },
    form: { type: String },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    pharmacyId: { type: String, required: true }
  }],
  cart: [{
    medicineId: { type: String },
    pharmacyId: { type: String },
    name: { type: String },
    quantity: { type: Number },
    price: { type: Number },
    total: { type: Number }
  }],
  items: [{
    medicine: { type: String },
    pharmacyId: { type: String },
    name: { type: String },
    quantity: { type: Number },
    price: { type: Number }
  }],
  prescriptionDetails: {
    fileUrl: { type: String },
    fileName: { type: String },
    uploadedAt: { type: Date }
  },
  deliveryInfo: {
    address: { type: String },
    trackingNumber: { type: String },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date }
  },
  payment: {
    method: { type: String, enum: ['cod', 'card', 'online'], default: 'cod' },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String },
    amount: { type: Number },
    paidAt: { type: Date }
  },
  totalAmount: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 50 },
  deliveryFee: { type: Number, default: 50 },
  taxAmount: { type: Number, default: 0 },
  finalAmount: { type: Number },
  total: { type: Number },
  subtotal: { type: Number },
  requiresPrescription: { type: Boolean, default: false },
  prescriptionVerified: { type: Boolean, default: null },
  status: { 
    type: String, 
    enum: ['pending', 'pending_prescription', 'pending_review', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  pharmacyId: { type: String },
  userId: { type: String },
  pharmacyNotes: { type: String },
  notes: { type: String },
  cancellationReason: { type: String }
}, {
  timestamps: true
});

// Indexes
medicineOrderSchema.index({ orderId: 1 }, { unique: true });
medicineOrderSchema.index({ orderNumber: 1 }, { unique: true });
medicineOrderSchema.index({ 'medicines.pharmacyId': 1 });
medicineOrderSchema.index({ userId: 1 });
medicineOrderSchema.index({ 'patientInfo.email': 1 });

const MedicineOrder = mongoose.model('MedicineOrder', medicineOrderSchema);

export default MedicineOrder;






