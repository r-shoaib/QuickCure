// pharmacyDashboardRoutes.js
import express from 'express';
import mongoose from 'mongoose';
import Pharmacy from '../models/Pharmacy.js';
import MedicineOrder from '../models/MedicineOrder.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/pharmacies');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `pharmacy-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Helper function to format order consistently (used across all order endpoints)
const formatOrder = (order) => {
  // Get medicines/items array - check all possible locations
  const rawItems = order.medicines || order.items || order.cart || [];
  
  // Format items with complete details including tablet info
  const formattedItems = rawItems.map(item => {
    const quantity = item.quantity || 1;
    const price = item.price || 0;
    const tabletQuantity = item.tabletQuantity || (quantity * (item.tabletsPerUnit || 10));
    const isTablet = item.form?.toLowerCase().includes('tablet') || item.form?.toLowerCase().includes('capsule');
    
    return {
      id: item._id || item.medicineId || item.id,
      medicineId: item.medicineId || item.id || item._id,
      name: item.name || 'Medicine',
      quantity: quantity,
      price: price,
      total: item.total || item.itemTotal || (price * quantity) || 0,
      // Tablet specific info
      form: item.form || 'tablet',
      isTablet: isTablet,
      tabletQuantity: tabletQuantity,
      tabletsPerUnit: item.tabletsPerUnit || 10,
      unit: isTablet ? 'tablets' : 'units'
    };
  });
  
  // Calculate totals
  const calculatedSubtotal = formattedItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const orderTotal = order.total || order.finalAmount || order.totalAmount || calculatedSubtotal;
  
  // Get customer info - check all possible paths
  const customerInfo = {
    name: order.patientInfo?.name || order.patient?.name || order.customer?.name || 'Customer',
    email: order.patientInfo?.email || order.patient?.email || order.customer?.email || '',
    phone: order.patientInfo?.phone || order.patient?.phone || order.customer?.phone || 'N/A',
    address: order.patientInfo?.address || order.patient?.address || order.deliveryInfo?.address || order.customer?.address || 'N/A'
  };
  
  // Format date
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = orderDate.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const dayName = orderDate.toLocaleDateString('en-PK', { weekday: 'short' });
  
  return {
    _id: order._id,
    id: order._id,
    orderNumber: order.orderNumber || order.orderId || `ORD-${order._id.toString().slice(-6)}`,
    orderId: order.orderNumber || order.orderId || `ORD-${order._id.toString().slice(-6)}`,
    
    // Customer info
    customer: customerInfo,
    patientInfo: customerInfo,
    patient: customerInfo,
    
    // Delivery address
    deliveryAddress: customerInfo.address,
    
    // Items with complete details
    products: formattedItems,
    cart: formattedItems,
    medicines: formattedItems,
    items: formattedItems,
    
    // Item count summary
    totalItems: formattedItems.reduce((sum, item) => sum + item.quantity, 0),
    totalTablets: formattedItems.reduce((sum, item) => sum + (item.tabletQuantity || 0), 0),
    
    // Amounts
    subtotal: order.subtotal || calculatedSubtotal,
    total: orderTotal,
    totalAmount: orderTotal,
    finalAmount: orderTotal,
    deliveryFee: order.deliveryFee || order.deliveryCharge || 0,
    deliveryCharge: order.deliveryCharge || order.deliveryFee || 0,
    
    // Status
    status: order.status || 'pending',
    paymentStatus: order.paymentStatus || order.payment?.status || 'pending',
    paymentMethod: order.paymentMethod || order.payment?.method || 'cod',
    
    // Dates
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    date: formattedDate,
    day: dayName,
    fullDate: `${dayName}, ${formattedDate}`,
    
    // Other
    notes: order.notes || '',
    prescriptionRequired: order.requiresPrescription || order.prescriptionRequired || false,
    prescriptionVerified: order.prescriptionVerified || false
  };
};

// ==================== GET PHARMACY BY USER ID ====================
// GET /api/pharmacies/dashboard/my-pharmacy?userId=123
router.get('/my-pharmacy', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const pharmacy = await Pharmacy.findOne({ userId });
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not registered' });
    }

    res.json({ success: true, data: pharmacy });
  } catch (error) {
    console.error('Error in /my-pharmacy:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PHARMACY PROFILE ENDPOINTS ====================

// GET /api/pharmacies/:pharmacyId - Get pharmacy profile
router.get('/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    res.json({ success: true, data: pharmacy });
  } catch (error) {
    console.error('Error fetching pharmacy profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/pharmacies/:pharmacyId - Update pharmacy profile
router.put('/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.userId;
    delete updateData.createdAt;
    
    // Handle image updates properly for customer side visibility
    if (updateData.logo) {
      // Update both logo and main image field for customer cards
      updateData.image = updateData.logo;
    }
    
    if (updateData.banner) {
      // Update both banner fields
      updateData.bannerImage = updateData.banner;
    }
    
    // If image is provided directly, use it
    if (updateData.image && !updateData.logo) {
      updateData.logo = updateData.image;
    }
    
    const pharmacy = await Pharmacy.findByIdAndUpdate(
      pharmacyId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    res.json({ success: true, data: pharmacy, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating pharmacy profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/pharmacies/:pharmacyId/upload - Upload image (logo or banner)
router.post('/:pharmacyId/upload', upload.single('image'), async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { type } = req.body; // 'logo' or 'banner'
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    
    if (!type || !['logo', 'banner'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Image type must be "logo" or "banner"' });
    }
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    // Store only the relative path (not full URL) for flexibility
    const imageUrl = `/uploads/pharmacies/${req.file.filename}`;
    
    // Update the appropriate fields for customer side visibility
    if (type === 'logo') {
      pharmacy.logo = imageUrl;
      // Also update the main image field for customer card display
      pharmacy.image = imageUrl;
    } else if (type === 'banner') {
      pharmacy.bannerImage = imageUrl;
      pharmacy.banner = imageUrl;
    }
    
    await pharmacy.save();
    
    res.json({ 
      success: true, 
      data: { url: imageUrl, type: type },
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully` 
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/pharmacies/dashboard/:pharmacyId/image - Delete pharmacy image (logo or banner)
router.delete('/:pharmacyId/image', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { type } = req.query; // 'logo' or 'banner'

    if (!type || !['logo', 'banner'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Image type must be "logo" or "banner"' });
    }

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    // Get the image URL that will be deleted
    const imageUrl = type === 'logo' 
      ? (pharmacy.logo || pharmacy.image) 
      : (pharmacy.bannerImage || pharmacy.banner);

    // Try to delete the file from filesystem if it's a local upload
    if (imageUrl && !imageUrl.startsWith('http')) {
      const imagePath = path.join(__dirname, '../../', imageUrl.replace(/^[\\/]+/, ''));
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (fileError) {
        console.warn('Could not delete file from filesystem:', fileError.message);
      }
    }

    // Reset to default values
    if (type === 'logo') {
      pharmacy.logo = null;
      pharmacy.image = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=500';
    } else if (type === 'banner') {
      pharmacy.bannerImage = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1600';
      pharmacy.banner = null;
    }

    await pharmacy.save();

    res.json({ 
      success: true, 
      data: pharmacy,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} removed successfully` 
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



// ==================== DASHBOARD STATS ====================
// GET /api/pharmacies/dashboard/:pharmacyId/stats
router.get('/:pharmacyId/stats', async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const medicines = pharmacy.medicines || [];
    
    // Get orders for this pharmacy
    let orders = [];
    try {
      orders = await MedicineOrder.find({ 
        $or: [
          { pharmacyId: pharmacyId },
          { 'items.pharmacyId': pharmacyId },
          { 'medicines.pharmacyId': pharmacyId },
          { 'medicines.pharmacy': pharmacyId }
        ]
      }).lean();
    } catch (e) {
      console.log('MedicineOrder model not found or error fetching orders');
    }

    // Medicine stats
    const totalMedicines = medicines.length;
    const lowStockCount = medicines.filter(m => (m.stockQuantity || 0) <= (m.reorderLevel || 10)).length;
    const outOfStockCount = medicines.filter(m => (m.stockQuantity || 0) === 0).length;
    
    // Order stats
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;

    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRevenue = orders
      .filter(o => o.status === 'delivered' && new Date(o.createdAt) >= today)
      .reduce((sum, o) => sum + (o.totalAmount || o.total || o.finalAmount || 0), 0);

    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.totalAmount || o.total || o.finalAmount || 0), 0);

    // Unique customers
    const uniqueCustomers = new Set(orders.map(o => o.userId?.toString()).filter(Boolean)).size;

    res.json({
      success: true,
      data: {
        totalMedicines,
        totalOrders,
        pendingOrders,
        completedOrders,
        todayRevenue,
        totalRevenue,
        lowStockCount,
        outOfStockCount,
        expiredCount: 0,
        inStockCount: totalMedicines - (lowStockCount + outOfStockCount),
        growthRate: 12.5,
        totalCustomers: uniqueCustomers
      }
    });
  } catch (error) {
    console.error('Error in dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== RECENT ORDERS ====================
// GET /api/pharmacies/dashboard/:pharmacyId/orders/recent?limit=5
router.get('/:pharmacyId/orders/recent', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { limit = 5 } = req.query;

    let orders = [];
    try {
      orders = await MedicineOrder.find({ 
        $or: [
          { pharmacyId: pharmacyId },
          { 'items.pharmacyId': pharmacyId },
          { 'medicines.pharmacyId': pharmacyId },
          { 'medicines.pharmacy': pharmacyId }
        ]
      })
        .sort('-createdAt')
        .limit(parseInt(limit))
        .lean();
    } catch (e) {
      console.log('MedicineOrder model not found');
    }

    const formattedOrders = orders.map(order => formatOrder(order));

    res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ALL ORDERS ====================
// GET /api/pharmacies/dashboard/:pharmacyId/orders
router.get('/:pharmacyId/orders', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    let orders = [];
    try {
      orders = await MedicineOrder.find({ 
        $or: [
          { pharmacyId: pharmacyId },
          { 'items.pharmacyId': pharmacyId },
          { 'medicines.pharmacyId': pharmacyId },
          { 'medicines.pharmacy': pharmacyId }
        ]
      }).sort('-createdAt').lean(); // ✅ Use .lean() for plain objects
    } catch (e) {
      console.log('MedicineOrder model not found');
    }
    
    // ✅ FIXED: Complete field mapping with all details using helper function
    const formattedOrders = orders.map(order => formatOrder(order));
    
    res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== UPDATE ORDER STATUS ====================
// PUT /api/pharmacies/dashboard/:pharmacyId/orders/:orderId/status
router.put('/:pharmacyId/orders/:orderId/status', async (req, res) => {
  try {
    const { pharmacyId, orderId } = req.params;
    const { status } = req.body;
    
    const order = await MedicineOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.status = status;
    order.updatedAt = new Date();
    await order.save();
    
    res.json({ success: true, data: formatOrder(order.toObject()) });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MEDICINE CRUD OPERATIONS ====================
// GET /api/pharmacies/dashboard/:pharmacyId/medicines
router.get('/:pharmacyId/medicines', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    res.json({ success: true, data: pharmacy.medicines || [] });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/pharmacies/dashboard/:pharmacyId/medicines
router.post('/:pharmacyId/medicines', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const medicineData = req.body;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    const newMedicine = {
      _id: new mongoose.Types.ObjectId(),
      ...medicineData,
      addedAt: new Date(),
      updatedAt: new Date()
    };
    
    pharmacy.medicines.push(newMedicine);
    await pharmacy.save();
    
    res.json({ success: true, data: newMedicine });
  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/pharmacies/dashboard/:pharmacyId/medicines/:medicineId
router.put('/:pharmacyId/medicines/:medicineId', async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    const updateData = req.body;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    const medicineIndex = pharmacy.medicines.findIndex(m => m._id.toString() === medicineId);
    if (medicineIndex === -1) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    
    pharmacy.medicines[medicineIndex] = {
      ...pharmacy.medicines[medicineIndex].toObject(),
      ...updateData,
      updatedAt: new Date()
    };
    
    await pharmacy.save();
    
    res.json({ success: true, data: pharmacy.medicines[medicineIndex] });
  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/pharmacies/dashboard/:pharmacyId/medicines/:medicineId
router.delete('/:pharmacyId/medicines/:medicineId', async (req, res) => {
  try {
    const { pharmacyId, medicineId } = req.params;
    
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    
    pharmacy.medicines = pharmacy.medicines.filter(m => m._id.toString() !== medicineId);
    await pharmacy.save();
    
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== INVENTORY ALERTS ====================
// GET /api/pharmacies/dashboard/:pharmacyId/medicines/alerts
router.get('/:pharmacyId/medicines/alerts', async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const medicines = pharmacy.medicines || [];
    
    const alerts = medicines.filter(m => {
      const stock = m.stockQuantity || 0;
      const reorderLevel = m.reorderLevel || 10;
      return stock <= reorderLevel || stock === 0;
    });

    const formattedAlerts = alerts.map(med => ({
      id: med._id,
      name: med.name,
      brand: med.manufacturer || 'Generic',
      category: med.category || 'Other',
      stock: med.stockQuantity || 0,
      reorderLevel: med.reorderLevel || 10,
      status: (med.stockQuantity || 0) === 0 ? 'Out of Stock' : 
              (med.stockQuantity || 0) <= 5 ? 'Critical' : 'Low Stock'
    }));

    res.json({ success: true, data: formattedAlerts });
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CATEGORY DISTRIBUTION ====================
// GET /api/pharmacies/dashboard/:pharmacyId/categories/distribution
router.get('/:pharmacyId/categories/distribution', async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const medicines = pharmacy.medicines || [];
    const distribution = {};

    medicines.forEach(med => {
      const cat = med.category || 'Other';
      distribution[cat] = (distribution[cat] || 0) + 1;
    });

    const data = Object.entries(distribution).map(([name, count]) => ({
      name,
      count,
      value: count,
      percentage: medicines.length > 0 ? Math.round((count / medicines.length) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching category distribution:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SALES DATA ====================
// GET /api/pharmacies/dashboard/:pharmacyId/sales?period=week
router.get('/:pharmacyId/sales', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { period = 'week' } = req.query;

    let orders = [];
    try {
      orders = await MedicineOrder.find({ 
        $or: [
          { pharmacyId: pharmacyId },
          { 'items.pharmacyId': pharmacyId },
          { 'medicines.pharmacyId': pharmacyId },
          { 'medicines.pharmacy': pharmacyId }
        ],
        status: 'delivered' 
      }).lean();
    } catch (e) {
      console.log('MedicineOrder model not found');
    }

    let data = [];

    if (period === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      data = days.map(day => ({ day, revenue: 0, sales: 0, orders: 0 }));
      
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      orders.filter(o => new Date(o.createdAt) >= lastWeek).forEach(order => {
        const dayIndex = new Date(order.createdAt).getDay();
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const amount = order.totalAmount || order.total || order.finalAmount || 0;
        data[adjustedIndex].revenue += amount;
        data[adjustedIndex].sales += amount;
        data[adjustedIndex].orders += 1;
      });
    } else if (period === 'month') {
      data = [
        { week: 'Week 1', revenue: 0, sales: 0, orders: 0 },
        { week: 'Week 2', revenue: 0, sales: 0, orders: 0 },
        { week: 'Week 3', revenue: 0, sales: 0, orders: 0 },
        { week: 'Week 4', revenue: 0, sales: 0, orders: 0 }
      ];
      
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      orders.filter(o => new Date(o.createdAt) >= firstDayOfMonth).forEach(order => {
        const dayOfMonth = new Date(order.createdAt).getDate();
        const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
        const amount = order.totalAmount || order.total || order.finalAmount || 0;
        data[weekIndex].revenue += amount;
        data[weekIndex].sales += amount;
        data[weekIndex].orders += 1;
      });
    } else if (period === 'year') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      data = months.map(month => ({ month, revenue: 0, sales: 0, orders: 0 }));
      
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      
      orders.filter(o => new Date(o.createdAt) >= lastYear).forEach(order => {
        const monthIndex = new Date(order.createdAt).getMonth();
        const amount = order.totalAmount || order.total || order.finalAmount || 0;
        data[monthIndex].revenue += amount;
        data[monthIndex].sales += amount;
        data[monthIndex].orders += 1;
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== TOP PRODUCTS ====================
// GET /api/pharmacies/dashboard/:pharmacyId/top-products?limit=5
router.get('/:pharmacyId/top-products', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { limit = 5 } = req.query;

    let orders = [];
    try {
      orders = await MedicineOrder.find({ 
        $or: [
          { pharmacyId: pharmacyId },
          { 'items.pharmacyId': pharmacyId },
          { 'medicines.pharmacyId': pharmacyId },
          { 'medicines.pharmacy': pharmacyId }
        ]
      }).lean();
    } catch (e) {
      console.log('MedicineOrder model not found');
    }

    const productSales = {};
    
    orders.forEach(order => {
      const items = order.items || order.medicines || order.cart || [];
      items.forEach(item => {
        const itemName = item.name || 'Unknown Medicine';
        if (!productSales[itemName]) {
          productSales[itemName] = {
            name: itemName,
            sales: 0,
            quantity: 0,
            growth: Math.floor(Math.random() * 20) + 5
          };
        }
        const itemTotal = item.total || item.itemTotal || (item.price * item.quantity) || 0;
        productSales[itemName].sales += itemTotal;
        productSales[itemName].quantity += item.quantity || 1;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, parseInt(limit));

    res.json({ success: true, data: topProducts });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;