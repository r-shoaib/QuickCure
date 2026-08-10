import User from "../models/user.model.js";
import Lab from "../models/lab.model.js";
import Pharmacy from "../models/Pharmacy.js";
import Doctor from "../models/doctors.model.js";
import Technician from "../models/technician.model.js";
/* ================= GET ALL USERS ================= */
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};

/* ================= GET USER BY ID ================= */
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Invalid user ID" });
  }
};

/* ================= UPDATE USER ROLE ================= */
export const updateRole = async (req, res) => {
  try {
    const { role } = req.body;

    const allowedRoles = ["admin", "doctor", "lab", "pharmacy", "technician", "user"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ msg: "Invalid role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.role = role;

    let entityCreated = false;
    let entity = null;

    // Auto-create entity record based on role
    if (role === 'pharmacy') {
      entity = await Pharmacy.findOne({ userId: user._id });
      
      if (!entity) {
        const pharmacyName = user.name 
          ? `${user.name}'s Pharmacy` 
          : `${user.email.split('@')[0]}'s Pharmacy`;

        entity = await Pharmacy.create({
          name: pharmacyName,
          address: "Please update your address",
          city: "Please update city",
          phone: user.phone || "Please update phone",
          email: user.email,
          userId: user._id,
          location: {
            type: 'Point',
            coordinates: [67.0011, 24.8607] // Default Karachi coordinates
          },
          open: true,
          deliveryTime: "30 mins",
          rating: 4.0,
          image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=500",
          bannerImage: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1600",
          medicines: []
        });
        user.pharmacyId = entity._id;
        entityCreated = true;
      } else {
        user.pharmacyId = entity._id;
      }
    } 
    else if (role === 'doctor') {
      entity = await Doctor.findOne({ user: user._id });
      
      if (!entity) {
        entity = await Doctor.create({
          name: user.name || 'Doctor',
          speciality: "General Physician",
          qualification: "",
          experience: "",
          fee: 500,
          user: user._id,
          isActive: true
        });
        user.doctorId = entity._id;
        entityCreated = true;
      } else {
        user.doctorId = entity._id;
      }
    }
    else if (role === 'lab') {
      entity = await Lab.findOne({ userId: user._id });
      
      if (!entity) {
        const labName = user.name 
          ? `${user.name}'s Lab` 
          : `${user.email.split('@')[0]}'s Lab`;

        entity = await Lab.create({
          name: labName,
          branches: 'Main Branch',
          discount: 0,
          userId: user._id
        });
        user.labId = entity._id;
        entityCreated = true;
      } else {
        user.labId = entity._id;
      }
    }
    else if (role === 'technician') {
      entity = await Technician.findOne({ _id: user.technicianId });
      
      if (!entity) {
        // Create new technician profile
        entity = await Technician.create({
          name: user.name || 'Technician',
          phone: user.phone || "Please update phone",
          email: user.email,
          city: "Please update city",
          labId: req.body.labId || null, // Required: lab assignment from admin
          isActive: true,
          availability: 'available',
          assignedBookings: []
        });
        user.technicianId = entity._id;
        entityCreated = true;
      } else {
        user.technicianId = entity._id;
      }
    }

    await user.save();

    let msg = "Role updated successfully";
    if (entityCreated) {
      msg = `Role updated and ${role} profile created`;
    }

    res.status(200).json({
      success: true,
      msg,
      user,
      entity: entity ? {
        _id: entity._id,
        name: entity.name || entity.pharmacyName || ''
      } : null
    });

  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};

/* ================= DELETE USER ================= */
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.role === "admin") {
      return res.status(403).json({ msg: "Admin cannot be deleted" });
    }

    // Delete associated records
    if (user.role === 'pharmacy') {
      await Pharmacy.findOneAndDelete({ userId: user._id });
    }
    if (user.role === 'lab') {
      await Lab.findOneAndDelete({ userId: user._id });
    }
    if (user.role === 'doctor') {
      await Doctor.findOneAndDelete({ user: user._id });
    }
    if (user.role === 'technician') {
      await Technician.findOneAndDelete({ _id: user.technicianId });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      msg: "User deleted successfully"
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};
// ==================== DOCTOR FUNCTIONS (EXACTLY LIKE LAB) ====================
export const createDoctorForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, speciality, qualification, experience, fee, services, availability } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // check existing doctor
    const existingDoctor = await Doctor.findOne({ user: userId });

    if (existingDoctor) {
      return res.status(400).json({
        msg: "Doctor already exists for this user"
      });
    }

    const image = req.file ? req.file.filename : null;

    // Parse services and availability if sent as JSON strings
    let parsedServices = services;
    let parsedAvailability = availability;
    
    if (typeof services === 'string') {
      try { parsedServices = JSON.parse(services); } catch(e) { parsedServices = []; }
    }
    
    if (typeof availability === 'string') {
      try { parsedAvailability = JSON.parse(availability); } catch(e) { parsedAvailability = []; }
    }

    const newDoctor = await Doctor.create({
      name: name || user.name,
      speciality: speciality || "General Physician",
      qualification: qualification || "",
      experience: experience || "",
      fee: fee || 500,
      services: parsedServices || [],
      availability: parsedAvailability || [],
      image: image,
      user: userId,
      isActive: true
    });

    user.role = "doctor";
    await user.save();

    res.status(201).json({
      success: true,
      doctor: newDoctor
    });

  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
// ==================== LAB FUNCTIONS (YOUR EXISTING CODE) ====================
export const createLabForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, branches, discount } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // check existing lab
    const existingLab = await Lab.findOne({ userId });

    if (existingLab) {
      return res.status(400).json({
        msg: "Lab already exists for this user"
      });
    }

    const logo = req.file ? req.file.filename : null;

    const newLab = await Lab.create({
      name,
      branches,
      discount,
      logo,
      userId
    });

    user.role = "lab";
    await user.save();

    res.status(201).json({
      success: true,
      lab: newLab
    });

  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// ==================== DASHBOARD STATS ====================
export const getAdminDashboardStats = async (req, res) => {
  try {
    const User = await import("../models/user.model.js").then(m => m.default);
    const Appointment = await import("../models/appointment.model.js").then(m => m.default);
    const MedicineOrder = await import("../models/MedicineOrder.js").then(m => m.default);
    const Lab = await import("../models/lab.model.js").then(m => m.default);
    const Pharmacy = await import("../models/Pharmacy.js").then(m => m.default);
    const Doctor = await import("../models/doctors.model.js").then(m => m.default);
    const TestBooking = await import("../models/testBooking.models.js").then(m => m.default);
    const Payment = await import("../models/Payment.js").then(m => m.default);

    // Get counts
    const totalUsers = await User.countDocuments();
    const totalDoctors = await User.countDocuments({ role: 'doctor' });
    const totalLabs = await User.countDocuments({ role: 'lab' });
    const totalPharmacies = await User.countDocuments({ role: 'pharmacy' });
    const totalTechnicians = await User.countDocuments({ role: 'technician' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // Get appointment stats
    const totalAppointments = await Appointment.countDocuments();
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ status: 'cancelled' });

    // Get order stats
    const totalOrders = await MedicineOrder.countDocuments();
    const pendingOrders = await MedicineOrder.countDocuments({ status: 'pending' });
    const deliveredOrders = await MedicineOrder.countDocuments({ status: 'delivered' });

    // Get lab bookings
    const totalLabBookings = await TestBooking.countDocuments();

    // Get entity profiles
    const registeredLabs = await Lab.countDocuments();
    const registeredPharmacies = await Pharmacy.countDocuments();
    const registeredDoctors = await Doctor.countDocuments();

    // Revenue calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Monthly revenue from appointments (completed)
    const monthlyAppointmentRevenue = await Appointment.aggregate([
      { $match: { status: 'completed', updatedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$fee' } } }
    ]);

    // Monthly revenue from orders (delivered)
    const monthlyOrderRevenue = await MedicineOrder.aggregate([
      { $match: { status: 'delivered', updatedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Yearly revenue from appointments
    const yearlyAppointmentRevenue = await Appointment.aggregate([
      { $match: { status: 'completed', updatedAt: { $gte: startOfYear } } },
      { $group: { _id: null, total: { $sum: '$fee' } } }
    ]);

    // Yearly revenue from orders
    const yearlyOrderRevenue = await MedicineOrder.aggregate([
      { $match: { status: 'delivered', updatedAt: { $gte: startOfYear } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Monthly revenue breakdown (last 12 months)
    const monthlyRevenue = await MedicineOrder.aggregate([
      { $match: { status: 'delivered' } },
      {
        $group: {
          _id: { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Get recent signups
    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          doctors: totalDoctors,
          labs: totalLabs,
          pharmacies: totalPharmacies,
          technicians: totalTechnicians,
          admins: totalAdmins,
          recent: recentUsers
        },
        appointments: {
          total: totalAppointments,
          pending: pendingAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          delivered: deliveredOrders
        },
        entities: {
          labs: registeredLabs,
          pharmacies: registeredPharmacies,
          doctors: registeredDoctors,
          labBookings: totalLabBookings
        },
        revenue: {
          monthlyAppointment: monthlyAppointmentRevenue[0]?.total || 0,
          monthlyOrder: monthlyOrderRevenue[0]?.total || 0,
          yearlyAppointment: yearlyAppointmentRevenue[0]?.total || 0,
          yearlyOrder: yearlyOrderRevenue[0]?.total || 0,
          monthlyBreakdown: monthlyRevenue
        }
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, msg: error.message });
  }
};

// ==================== GET ALL APPOINTMENTS ====================
export const getAllAppointments = async (req, res) => {
  try {
    const Appointment = await import("../models/appointment.model.js").then(m => m.default);
    const appointments = await Appointment.find()
      .populate('doctor', 'name speciality fee')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
};

// ==================== GET ALL ORDERS ====================
export const getAllOrders = async (req, res) => {
  try {
    const MedicineOrder = await import("../models/MedicineOrder.js").then(m => m.default);
    const orders = await MedicineOrder.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
};

// ==================== GET ALL LAB BOOKINGS ====================
export const getAllLabBookings = async (req, res) => {
  try {
    const TestBooking = await import("../models/testBooking.models.js").then(m => m.default);
    const bookings = await TestBooking.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
};

// ==================== PHARMACY FUNCTIONS (NEW - EXACTLY LIKE LAB) ====================
export const createPharmacyForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, address, city, phone, deliveryTime, distance } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        msg: "User not found" 
      });
    }

    // Check existing pharmacy
    const existingPharmacy = await Pharmacy.findOne({ userId });
    if (existingPharmacy) {
      return res.status(400).json({
        success: false,
        msg: "Pharmacy already exists for this user",
        pharmacy: existingPharmacy
      });
    }

    // Handle image upload - store relative path
    const image = req.file ? `/uploads/pharmacies/${req.file.filename}` : null;

    // Create pharmacy name - lab ki tarah
    const pharmacyName = name || (user.name 
      ? `${user.name}'s Pharmacy` 
      : `${user.email.split('@')[0]}'s Pharmacy`);

    // Create new pharmacy - lab ki tarah
    const newPharmacy = await Pharmacy.create({
      name: pharmacyName,
      address: address || "Please update your address",
      city: city || "Please update city",
      phone: phone || "Please update phone",
      email: user.email,
      userId: user._id,
      location: {
        type: 'Point',
        coordinates: [67.0011, 24.8607] // Default Karachi coordinates
      },
      open: true,
      deliveryTime: deliveryTime || "30 mins",
      distance: distance || "0 km",
      rating: 4.0,
      image: image || "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=500",
      logo: image,
      bannerImage: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1600",
      currency: "PKR",
      timezone: "Asia/Karachi",
      taxRate: 17,
      deliveryRadius: 5,
      emergencyDelivery: true,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      openingTime: "09:00",
      closingTime: "23:00",
      medicines: []
    });

    // Update user role if needed - lab ki tarah
    if (user.role !== 'pharmacy') {
      user.role = "pharmacy";
      await user.save();
    }

    res.status(201).json({
      success: true,
      msg: "Pharmacy created successfully",
      pharmacy: newPharmacy
    });

  } catch (error) {
    console.error('Error creating pharmacy:', error);
    res.status(500).json({ 
      success: false, 
      msg: error.message 
    });
  }
};