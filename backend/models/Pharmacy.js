import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true
  },
  genericName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  detailedDescription: { type: String },
  
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountedPrice: {
    type: Number,
    min: [0, 'Discounted price cannot be negative']
  },
  discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
  inStock: { type: Boolean, default: true },
  stockQuantity: { type: Number, default: 100, min: [0, 'Stock cannot be negative'] },
  reorderLevel: { type: Number, default: 10, min: [0, 'Reorder level cannot be negative'] },
  
  category: {
    type: String,
    required: [true, 'Category is required']
  },
  dosage: { type: String, default: 'As prescribed' },
  strength: { type: String, trim: true },
  form: {
    type: String,
    enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Powder', 'Spray'],
    default: 'Tablet'
  },
  manufacturer: { type: String, trim: true },
  image: { type: String, default: 'https://images.unsplash.com/photo-1585435557343-3b092031d5ad?w=400' },
  
  sideEffects: [{ type: String }],
  uses: [{ type: String }],
  precautions: [{ type: String }],
  instructions: [{ type: String }],
  storageInstructions: { type: String, default: 'Store in a cool, dry place away from direct sunlight' },
  prescriptionRequired: { type: Boolean, default: false },
  
  tags: [{ type: String }],
  isFeatured: { type: Boolean, default: false },
  
  tabletsPerUnit: { type: Number, default: 10 },
  tabletsPerStrip: { type: Number, default: 10 },
  volume: { type: String, default: '60ml' },
  
  sku: { type: String, trim: true },
  batchNumber: { type: String, trim: true },
  packSize: { type: String },
  expiryDate: { type: Date },
  
  addedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

medicineSchema.pre('save', function(next) {
  if (this.stockQuantity) this.stockQuantity = Math.floor(this.stockQuantity);
  if (this.tabletsPerUnit) this.tabletsPerUnit = Math.floor(this.tabletsPerUnit);
  if (this.tabletsPerStrip) this.tabletsPerStrip = Math.floor(this.tabletsPerStrip);
  next();
});

const pharmacySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  
  city: { type: String, required: true },
  state: { type: String },
  deliveryTime: { type: String, default: '15-20 mins' },
  open: { type: Boolean, default: true },
  phone: String,
  email: String,
  rating: { type: Number, default: 4.0 },
  image: { type: String, default: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=500' },
  bannerImage: { type: String, default: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1600' },
  openingHours: { type: Map, of: String },
  services: [String],
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  
  deliverySettings: {
    baseDeliveryCharge: { type: Number, default: 50 },
    perKmCharge: { type: Number, default: 10 },
    freeDeliveryThreshold: { type: Number, default: 500 },
    preparationTime: { type: Number, default: 15 },
    averageDeliverySpeed: { type: Number, default: 20 }
  },
  
  currency: { type: String, default: 'PKR' },
  timezone: { type: String, },
  deliveryRadius: { type: Number },
  deliveryFee: { type: Number, default: 100 },
  minimumOrderAmount: { type: Number, default: 0 },
  freeDeliveryThreshold: { type: Number, default: 0 },
  workingDays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  openingTime: { type: String, default: '09:00' },
  closingTime: { type: String, default: '23:00' },
  
  logo: String,
  banner: String,
  whatsapp: { type: String, default: '' },
  facebook: { type: String, default: '' },
  instagram: { type: String, default: '' },
  description: { type: String, default: '' },
  
  licenseNumber: String,
  licenseExpiry: Date,
  yearEstablished: Number,
  ownerName: String,
  pharmacyType: String,
  
  medicines: [medicineSchema]
}, { timestamps: true });

pharmacySchema.index({ location: '2dsphere' });
pharmacySchema.index({
  'medicines.name': 'text',
  'medicines.genericName': 'text',
  'medicines.description': 'text',
  'medicines.category': 'text'
});

const Pharmacy = mongoose.model('Pharmacy', pharmacySchema);
export default Pharmacy;


