import MedicineOrder from '../models/MedicineOrder.js';
import Pharmacy from '../models/Pharmacy.js';

export const createOrder = async (req, res) => {
  try {
    let requestBody = req.body;
    
    // Handle file upload if present
    if (req.file) {
      const fileUrl = `/uploads/${req.file.filename}`;
      
      let parsedPatient = {};
      let parsedMedicines = [];
      let parsedPrescriptionDetails = {};
      let parsedDeliveryInfo = {};
      let parsedPayment = {};
      
      try {
        if (req.body.patient) {
          parsedPatient = typeof req.body.patient === 'string' 
            ? JSON.parse(req.body.patient) 
            : req.body.patient;
        }
        
        if (req.body.medicines) {
          parsedMedicines = typeof req.body.medicines === 'string'
            ? JSON.parse(req.body.medicines)
            : req.body.medicines;
        }
        
        if (req.body.prescriptionDetails) {
          parsedPrescriptionDetails = typeof req.body.prescriptionDetails === 'string'
            ? JSON.parse(req.body.prescriptionDetails)
            : req.body.prescriptionDetails;
        }
        
        if (req.body.deliveryInfo) {
          parsedDeliveryInfo = typeof req.body.deliveryInfo === 'string'
            ? JSON.parse(req.body.deliveryInfo)
            : req.body.deliveryInfo;
        }
        
        if (req.body.payment) {
          parsedPayment = typeof req.body.payment === 'string'
            ? JSON.parse(req.body.payment)
            : req.body.payment;
        }
      } catch (parseError) {
        console.error('Error parsing form data:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON data in form fields'
        });
      }
      
      requestBody = {
        ...req.body,
        patient: parsedPatient,
        medicines: parsedMedicines,
        prescriptionDetails: {
          ...parsedPrescriptionDetails,
          fileUrl: fileUrl,
          fileName: req.file.originalname,
          uploadedAt: new Date()
        },
        deliveryInfo: parsedDeliveryInfo,
        payment: parsedPayment,
        pharmacyNotes: req.body.pharmacyNotes,
        notes: req.body.notes
      };
    }

    const {
      patient,
      medicines,
      prescriptionDetails: prescriptionDetailsFromBody,
      deliveryInfo,
      payment,
      pharmacyNotes,
      notes
    } = requestBody;

    const patientData = patient || requestBody.patientInfo;
    
    if (!patientData || !patientData.name || !patientData.email || !patientData.phone || !patientData.address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete patient information'
      });
    }

    const medicinesData = medicines || requestBody.cart || requestBody.medicinesList || requestBody.items;
    
    if (!medicinesData || !Array.isArray(medicinesData) || medicinesData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add medicines to your order'
      });
    }

    let totalAmount = 0;
    let deliveryCharge = requestBody.deliveryCharge || requestBody.deliveryFee || 50;
    const validatedMedicines = [];
    const pharmacyInstances = new Map();
    let requiresPrescription = false;

    // STEP 1: VALIDATE ALL MEDICINES AND CHECK STOCK
    for (const item of medicinesData) {
      const medicineId = item.medicineId || item.id || item._id || (item.medicine?._id || item.medicine);
      const pharmacyId = item.pharmacyId || item.pharmacy || requestBody.pharmacyId;
      const quantity = Number(item.quantity || item.qty || 1);
      const tabletQuantity = item.tabletQuantity || null;
      const form = item.form || 'tablet';

      if (!medicineId || !pharmacyId || !quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid medicine item data: ${JSON.stringify(item)}`
        });
      }

      let pharmacy;
      if (pharmacyInstances.has(pharmacyId)) {
        pharmacy = pharmacyInstances.get(pharmacyId);
      } else {
        pharmacy = await Pharmacy.findById(pharmacyId);
        if (pharmacy) pharmacyInstances.set(pharmacyId, pharmacy);
      }

      if (!pharmacy) {
        return res.status(404).json({
          success: false,
          message: `Pharmacy with ID ${pharmacyId} not found`
        });
      }

      const embeddedMedicine = pharmacy.medicines.id(medicineId);
      if (!embeddedMedicine) {
        const medicineByName = pharmacy.medicines.find(m => m._id.toString() === medicineId || m.name === item.name);
        if (!medicineByName) {
          return res.status(404).json({
            success: false,
            message: `Medicine "${item.name || medicineId}" not found in pharmacy ${pharmacy.name}`
          });
        }
        var medicineToUse = medicineByName;
      } else {
        var medicineToUse = embeddedMedicine;
      }

      const availableStock = medicineToUse.stockQuantity || 0;
      
      if (availableStock <= 0) {
        return res.status(400).json({
          success: false,
          message: `${medicineToUse.name} is out of stock (0 units available)`
        });
      }
      
      if (availableStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${medicineToUse.name}. Available: ${availableStock}, Requested: ${quantity}`
        });
      }

      const price = medicineToUse.discountedPrice || medicineToUse.price || 0;
      const itemTotal = price * quantity;
      totalAmount += itemTotal;

      if (medicineToUse.prescriptionRequired) {
        requiresPrescription = true;
      }

      validatedMedicines.push({
        medicine: medicineToUse._id,
        medicineId: medicineToUse._id,
        pharmacy: pharmacyId,
        pharmacyId: pharmacyId,
        pharmacyName: pharmacy.name,
        name: medicineToUse.name,
        quantity: Math.floor(quantity),
        tabletQuantity: tabletQuantity,
        form: form,
        price: price,
        image: medicineToUse.image,
        prescriptionRequired: medicineToUse.prescriptionRequired || false,
        genericName: medicineToUse.genericName,
        category: medicineToUse.category,
        total: itemTotal,
        itemTotal: itemTotal,
        tabletsPerUnit: medicineToUse.tabletsPerUnit || medicineToUse.tabletsPerStrip || 10,
        volume: medicineToUse.volume
      });
    }

    // CHECK PRESCRIPTION REQUIREMENT
    const prescriptionDetails = prescriptionDetailsFromBody || {};
    
    if (requiresPrescription && !prescriptionDetails.fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Prescription is required for one or more medicines in your order',
        requiresPrescription: true,
        medicinesRequiringPrescription: validatedMedicines
          .filter(item => item.prescriptionRequired)
          .map(item => item.name)
      });
    }

    // STEP 2: REDUCE STOCK
    for (const item of validatedMedicines) {
      const pharmacy = pharmacyInstances.get(item.pharmacyId);
      const medicine = pharmacy.medicines.id(item.medicine);
      
      if (medicine) {
        medicine.stockQuantity = Math.max(0, medicine.stockQuantity - item.quantity);
        medicine.inStock = medicine.stockQuantity > 0;
      }
    }

    // Save all pharmacies with updated stock
    for (const pharmacy of pharmacyInstances.values()) {
      await pharmacy.save();
    }

    const safeTotalAmount = totalAmount || 0;
    const safeDeliveryCharge = deliveryCharge || 0;
    const taxAmount = safeTotalAmount * 0.05;
    const finalAmount = safeTotalAmount + safeDeliveryCharge + taxAmount;

    let orderStatus = 'pending';
    let prescriptionVerifiedStatus = null;
    
    if (requiresPrescription) {
      if (prescriptionDetails.fileUrl) {
        orderStatus = 'pending_review';
        prescriptionVerifiedStatus = false;
      } else {
        orderStatus = 'pending_prescription';
      }
    }

    // 🔥 FIXED: Generate guaranteed unique IDs
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
    const uniqueOrderId = `ORD-${timestamp}-${randomStr}`;
    
    // Use orderNumber from request OR generate a new one (NEVER null)
    const orderNumber = requestBody.orderNumber || requestBody.orderId || uniqueOrderId;

    console.log('📝 Creating order with IDs:', {
      orderId: uniqueOrderId,
      orderNumber: orderNumber
    });

    // 🔥 CRITICAL: Ensure orderId is NEVER null or undefined
    const orderData = {
      orderId: uniqueOrderId,  // MUST be a unique string
      orderNumber: orderNumber, // MUST be a unique string
      patientInfo: {
        name: patientData.name,
        email: patientData.email,
        phone: patientData.phone,
        address: patientData.address,
        notes: notes || patientData.notes || ''
      },
      medicines: validatedMedicines,
      cart: validatedMedicines.map(item => ({
        id: item.medicine,
        _id: item.medicine,
        medicineId: item.medicine,
        pharmacyId: item.pharmacyId,
        name: item.name,
        quantity: item.quantity,
        tabletQuantity: item.tabletQuantity,
        form: item.form,
        price: item.price,
        total: item.total
      })),
      items: validatedMedicines,
      prescriptionDetails: prescriptionDetails || {},
      deliveryInfo: {
        address: patientData.address,
        ...deliveryInfo
      },
      payment: {
        method: payment?.method || 'cod',
        status: 'pending',
        amount: finalAmount
      },
      pharmacyNotes: pharmacyNotes || '',
      notes: notes || '',
      totalAmount: safeTotalAmount,
      deliveryCharge: safeDeliveryCharge,
      deliveryFee: safeDeliveryCharge,
      taxAmount: taxAmount,
      finalAmount: finalAmount,
      total: finalAmount,
      subtotal: safeTotalAmount,
      requiresPrescription: requiresPrescription,
      prescriptionVerified: prescriptionVerifiedStatus,
      status: orderStatus,
      pharmacyId: validatedMedicines[0]?.pharmacyId || null,
      userId: requestBody.userId || req.user?.id || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 🔥 Double-check that orderId is not null
    if (!orderData.orderId) {
      console.error('❌ orderId is null or undefined!');
      orderData.orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    }

    console.log('📦 Creating order with orderId:', orderData.orderId);

    const order = await MedicineOrder.create(orderData);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
      requiresPrescription,
      prescriptionUploaded: !!prescriptionDetails.fileUrl,
      orderStatus: orderStatus
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }
    
    if (error.code === 11000) {
      console.error('❌ Duplicate key error:', error.keyValue);
      return res.status(400).json({
        success: false,
        message: 'Duplicate order ID. Please try again.',
        error: 'DUPLICATE_ORDER'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get all orders (with filters)
// @route   GET /api/medicine-orders
// @access  Private/Admin
export const getOrders = async (req, res) => {
  try {
    const { 
      status, 
      patientEmail, 
      patientPhone, 
      startDate, 
      endDate, 
      pharmacyId,
      sort = '-createdAt',
      limit = 50,
      page = 1
    } = req.query;

    let query = {};

    if (status) query.status = status;
    if (patientEmail) query['patientInfo.email'] = patientEmail.toLowerCase();
    if (patientPhone) query['patientInfo.phone'] = patientPhone;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (pharmacyId) {
      query.$or = [
        { 'medicines.pharmacy': pharmacyId },
        { 'medicines.pharmacyId': pharmacyId },
        { pharmacyId: pharmacyId }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await MedicineOrder.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await MedicineOrder.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


export const getOrderById = async (req, res) => {
  try {
    const order = await MedicineOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching order:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get orders by patient
// @route   GET /api/medicine-orders/patient/:email
// @access  Private
export const getOrdersByPatient = async (req, res) => {
  try {
    const { email, userId } = req.params;
    const { status, limit = 50, page = 1 } = req.query;

    let query = {};
    
    // Support both email-based and userId-based queries
    if (userId) {
      query.userId = userId;
    } else if (email) {
      query['patientInfo.email'] = email.toLowerCase();
    }
    
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await MedicineOrder.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await MedicineOrder.countDocuments(query);

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.orderNumber || order.orderId,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount || order.finalAmount || 0,
      finalAmount: order.finalAmount || order.totalAmount || 0,
      total: order.total || order.finalAmount || 0,
      deliveryCharge: order.deliveryCharge || order.deliveryFee || 0,
      taxAmount: order.taxAmount || 0,
      createdAt: order.createdAt,
      medicines: order.medicines || order.items || order.cart || [],
      cart: order.cart || order.medicines || [],
      totalItems: (order.medicines || order.items || []).length,
      patientInfo: order.patientInfo,
      patient: order.patientInfo,
      payment: order.payment || { method: 'COD', status: 'pending' },
      notes: order.notes || ''
    }));

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      total,
      data: formattedOrders
    });
  } catch (error) {
    console.error('Error fetching patient orders:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, cancellationReason, prescriptionVerified } = req.body;

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status) {
      order.status = status;
      if (status === 'delivered') {
        order.deliveryStatus = { ...order.deliveryStatus, deliveredAt: new Date() };
      }
    }

    if (notes !== undefined) order.notes = notes;
    if (cancellationReason !== undefined) order.cancellationReason = cancellationReason;
    if (prescriptionVerified !== undefined) {
      order.prescriptionVerified = prescriptionVerified;
      if (prescriptionVerified && order.status === 'pending_review') {
        order.status = 'confirmed';
      }
    }

    order.updatedAt = new Date();
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Cancel order (with stock restoration)
// @route   PUT /api/medicine-orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const cancellableStatuses = ['pending', 'confirmed', 'processing', 'pending_review', 'pending_prescription'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.status} status`
      });
    }

    const medicines = order.medicines || order.items || [];
    
    for (const item of medicines) {
      const pharmacyId = item.pharmacyId || item.pharmacy;
      if (pharmacyId) {
        const pharmacy = await Pharmacy.findById(pharmacyId);
        if (pharmacy) {
          const medicine = pharmacy.medicines.id(item.medicine || item.medicineId);
          if (medicine) {
            medicine.stockQuantity += item.quantity;
            medicine.inStock = medicine.stockQuantity > 0;
            await pharmacy.save();
          }
        }
      }
    }

    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.payment.status = 'refunded';
    order.updatedAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update payment status
// @route   PUT /api/medicine-orders/:id/payment
// @access  Private/Admin
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, method } = req.body;

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status) order.payment.status = status;
    if (transactionId) order.payment.transactionId = transactionId;
    if (method) order.payment.method = method;
    if (status === 'paid') order.payment.paidAt = new Date();

    order.updatedAt = new Date();
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get order statistics
// @route   GET /api/medicine-orders/stats
// @access  Private/Admin
export const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await MedicineOrder.countDocuments();
    
    const ordersByStatus = await MedicineOrder.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOrders = await MedicineOrder.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const revenueStats = await MedicineOrder.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          averageOrderValue: { $avg: '$finalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        ordersByStatus,
        recentOrders,
        revenue: revenueStats[0] || { totalRevenue: 0, averageOrderValue: 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getPharmacyOrders = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { status, startDate, endDate } = req.query;

    let query = {
      $or: [
        { 'medicines.pharmacy': pharmacyId },
        { 'medicines.pharmacyId': pharmacyId },
        { pharmacyId: pharmacyId }
      ]
    };

    if (status) query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await MedicineOrder.find(query).sort('-createdAt');

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      patientInfo: order.patientInfo,
      medicines: order.medicines || order.items || [],
      totalAmount: order.totalAmount || order.finalAmount || 0,
      status: order.status,
      paymentStatus: order.payment?.status || 'pending',
      paymentMethod: order.payment?.method || 'cod',
      createdAt: order.createdAt,
      notes: order.notes,
      prescriptionRequired: order.requiresPrescription || false
    }));

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders
    });
  } catch (error) {
    console.error('Error fetching pharmacy orders:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Upload prescription for existing order
// @route   POST /api/medicine-orders/:id/prescription
// @access  Private
export const uploadPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a prescription file' });
    }

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    order.prescriptionDetails = {
      ...order.prescriptionDetails,
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      uploadedAt: new Date()
    };

    if (order.status === 'pending_prescription') {
      order.status = 'pending_review';
    }
    
    order.prescriptionVerified = false;
    order.updatedAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: {
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        orderStatus: order.status
      }
    });
  } catch (error) {
    console.error('Error uploading prescription:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};




































