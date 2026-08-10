import mongoose from "mongoose";
import Doctor from "../models/doctors.model.js";
// Helper function to safely parse JSON
const safeJsonParse = (data) => {
  if (!data) return undefined;
  
  if (typeof data !== 'string') {
    return data;
  }
  
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return data;
  }
};

// Convert 24-hour format (HH:MM) to 12-hour format with AM/PM
const convertTo12HourFormat = (time24) => {
  if (!time24) return time24;
  
  // If already in 12-hour format with AM/PM, return as is
  if (time24.includes('AM') || time24.includes('PM')) {
    return time24;
  }
  
  const [hours, minutes] = time24.split(':');
  let hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour;
  
  return `${hour}:${minutes} ${ampm}`;
};

// Convert 12-hour format (HH:MM AM/PM) to 24-hour format for storage
const convertTo24HourFormat = (time12) => {
  if (!time12) return time12;
  
  // If already in 24-hour format, return as is
  if (!time12.includes('AM') && !time12.includes('PM')) {
    return time12;
  }
  
  const [time, modifier] = time12.split(' ');
  let [hours, minutes] = time.split(':');
  
  let hour = parseInt(hours, 10);
  
  if (modifier === 'PM' && hour < 12) {
    hour += 12;
  }
  
  if (modifier === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
};

// Validate time in either 12-hour or 24-hour format
const validateTimeFormat = (time) => {
  // Accept 12-hour format (HH:MM AM/PM)
  const time12Regex = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
  
  // Accept 24-hour format (HH:MM)
  const time24Regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  return time12Regex.test(time) || time24Regex.test(time);
};

// Validate time slot with AM/PM support
const validateTimeSlot = (slot) => {
  if (!slot.day || !slot.startTime || !slot.endTime) {
    return { valid: false, error: "Each slot must have day, startTime, and endTime" };
  }
  
  // Validate time format
  if (!validateTimeFormat(slot.startTime) || !validateTimeFormat(slot.endTime)) {
    return { 
      valid: false, 
      error: "Time must be in HH:MM format (24-hour) or HH:MM AM/PM format (12-hour)" 
    };
  }
  
  // Convert to 24-hour format for comparison
  const start24 = convertTo24HourFormat(slot.startTime);
  const end24 = convertTo24HourFormat(slot.endTime);
  
  // Check if start time is before end time
  if (start24 >= end24) {
    return { valid: false, error: "Start time must be before end time" };
  }
  
  return { valid: true };
};

// Process availability before sending response (convert to 12-hour format)
const processAvailabilityForResponse = (availability) => {
  if (!availability || !Array.isArray(availability)) {
    return availability;
  }
  
  return availability.map(slot => ({
    ...slot,
    startTime: convertTo12HourFormat(slot.startTime),
    endTime: convertTo12HourFormat(slot.endTime)
  }));
};

// Process availability before saving (convert to 24-hour format)
const processAvailabilityForStorage = (availability) => {
  if (!availability || !Array.isArray(availability)) {
    return availability;
  }
  
  return availability.map(slot => ({
    ...slot,
    startTime: convertTo24HourFormat(slot.startTime),
    endTime: convertTo24HourFormat(slot.endTime)
  }));
};

// Get all active doctors
export const getAllDoctors = async (req, res) => {
  try {
    const { speciality, availableToday, minRating, maxFee, all } = req.query;
    
    let filter = {};
    
    // When 'all' parameter is passed (admin view), don't filter by isActive
    if (all !== 'true') {
      filter.isActive = true;
    }
    
    if (speciality) {
      filter.speciality = { $regex: new RegExp(speciality, "i") };
    }
    
    if (availableToday === 'true') {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      filter['availability.day'] = today;
      filter['availability.isAvailable'] = true;
    }
    
    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }
    
    if (maxFee) {
      filter.fee = { $lte: parseFloat(maxFee) };
    }
    
    const doctors = await Doctor.find(filter).sort({ rating: -1 });
    
    // Convert times to 12-hour format for response
    const doctorsWith12HourTime = doctors.map(doctor => ({
      ...doctor.toObject(),
      availability: doctor.availability

    }));
    
    res.json(doctorsWith12HourTime);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single doctor by ID
export const getDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findOne({ _id: id, isActive: true });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    
    res.json({
      ...doctor.toObject(),
      availability: doctor.availability
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get doctor by user ID (for dashboard linking)
export const getDoctorByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First try to find by user reference
    let doctor = await Doctor.findOne({ user: userId, isActive: true });
    if (doctor) {
      return res.json(doctor.toObject());
    }
    
    // If not found by user reference, try to find by matching email
    // The User model has an 'email' field, so we need to look up the user first
    const UserModel = mongoose.model('User');
    const user = await UserModel.findById(userId);
    if (user?.email) {
      // Search doctors - since Doctor model doesn't have email, try the registration
      doctor = await Doctor.findOne({ 
        name: { $regex: new RegExp(user.name?.split(' ')[0] || '', 'i') },
        isActive: true 
      });
      if (doctor) {
        return res.json(doctor.toObject());
      }
    }
    
    return res.status(404).json({ message: "Doctor not found for this user" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add new doctor
export const addDoctor = async (req, res) => {
  try {
    const { 
      name, 
      qualification, 
      experience, 
      fee,
      services, 
      speciality,
      availability 
    } = req.body;

    // Validate required fields
    if (!name || !speciality || fee === undefined) {
      return res.status(400).json({ 
        message: "Name, speciality, and fee are required" 
      });
    }

    // Parse services
    const parsedServices = safeJsonParse(services) || [];
    
    // Parse and validate availability
    const parsedAvailability = safeJsonParse(availability) || [];
    
    if (parsedAvailability.length > 0) {
      for (const slot of parsedAvailability) {
        const validation = validateTimeSlot(slot);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
      }
    }

    // Convert times to 24-hour format for storage
    const availabilityForStorage = processAvailabilityForStorage(parsedAvailability);

    const doctor = new Doctor({
      name,
      qualification,
      experience,
      fee: Number(fee),
      services: parsedServices,
      availability: availabilityForStorage,
      speciality,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });

    await doctor.save();
    
    // Convert back to 12-hour format for response
    const doctorWith12HourTime = {
      ...doctor.toObject(),
      availability: doctor.availability

    };
    
    res.status(201).json(doctorWith12HourTime);
  } catch (err) {
    console.error('Error in addDoctor:', err);
    res.status(500).json({ message: err.message });
  }
};

// Update doctor
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle file upload
    if (req.file) updateData.image = `/uploads/${req.file.filename}`;
    
    // Parse services if it exists
    if (updateData.services !== undefined) {
      updateData.services = safeJsonParse(updateData.services);
    }
    
    // Parse and validate availability if it exists
    if (updateData.availability !== undefined) {
      const parsedAvailability = safeJsonParse(updateData.availability);
      
      if (parsedAvailability && parsedAvailability.length > 0) {
        for (const slot of parsedAvailability) {
          const validation = validateTimeSlot(slot);
          if (!validation.valid) {
            return res.status(400).json({ message: validation.error });
          }
        }
        
        // Convert to 24-hour format for storage
        updateData.availability = processAvailabilityForStorage(parsedAvailability);
      } else {
        updateData.availability = parsedAvailability;
      }
    }
    
    // Convert fee to number if it exists
    if (updateData.fee !== undefined) {
      updateData.fee = Number(updateData.fee);
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    });
    
    if (!updatedDoctor) return res.status(404).json({ message: "Doctor not found" });
    
    // Convert times to 12-hour format for response
    const doctorWith12HourTime = {
      ...updatedDoctor.toObject(),
      availability: processAvailabilityForResponse(updatedDoctor.availability)
    };
    
    res.json(doctorWith12HourTime);
  } catch (err) {
    console.error('Error in updateDoctor:', err);
    res.status(500).json({ message: err.message });
  }
};

// Delete doctor (soft delete)
export const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDoctor = await Doctor.findByIdAndUpdate(
      id, 
      { isActive: false }, 
      { new: true }
    );
    
    if (!deletedDoctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ message: "Doctor deactivated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get doctors by speciality (case-insensitive)
export const getDoctorsBySpeciality = async (req, res) => {
  try {
    const { speciality } = req.params;
    const doctors = await Doctor.find({
      speciality: { $regex: new RegExp(`^${speciality}$`, "i") },
      isActive: true
    }).sort({ rating: -1 });
    
    // Convert times to 12-hour format for response
    const doctorsWith12HourTime = doctors.map(doctor => ({
      ...doctor.toObject(),
      availability: doctor.availability

    }));
    
    res.json(doctorsWith12HourTime);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update availability
export const updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { availability } = req.body;

    if (!availability) {
      return res.status(400).json({ message: "Availability data is required" });
    }

    const parsedAvailability = safeJsonParse(availability);
    
    if (!Array.isArray(parsedAvailability)) {
      return res.status(400).json({ message: "Availability must be an array" });
    }

    // Validate all time slots
    for (const slot of parsedAvailability) {
      const validation = validateTimeSlot(slot);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
    }

    const doctor = await Doctor.findById(id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    // Convert to 24-hour format for storage
    const availabilityForStorage = processAvailabilityForStorage(parsedAvailability);
    
    doctor.availability = availabilityForStorage;
    await doctor.save();

    res.json({ 
      message: "Availability updated successfully", 
      availability: doctor.availability

    });
  } catch (err) {
    console.error('Error in updateAvailability:', err);
    res.status(500).json({ message: err.message });
  }
};

// Search doctors with filters
export const searchDoctors = async (req, res) => {
  try {
    const { name, speciality, minRating, maxFee, day } = req.query;
    
    let filter = { isActive: true };
    
    if (name) {
      filter.name = { $regex: new RegExp(name, "i") };
    }
    
    if (speciality) {
      filter.speciality = { $regex: new RegExp(speciality, "i") };
    }
    
    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }
    
    if (maxFee) {
      filter.fee = { $lte: parseFloat(maxFee) };
    }
    
    if (day) {
      filter['availability.day'] = day;
      filter['availability.isAvailable'] = true;
    }
    
    const doctors = await Doctor.find(filter)
      .sort({ rating: -1 })
      .select('name speciality rating fee availability image');
    
    // Convert times to 12-hour format for response
    const doctorsWith12HourTime = doctors.map(doctor => ({
      ...doctor.toObject(),
          availability: doctor.availability

    }));
    
    res.json(doctorsWith12HourTime);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get doctor's availability
export const getDoctorAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id).select('name availability');
    
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    
    res.json({
      doctor: doctor.name,
      availability: doctor.availability

    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get today's available doctors
export const getAvailableToday = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    const doctors = await Doctor.find({
      isActive: true,
      'availability.day': today,
      'availability.isAvailable': true
    }).sort({ rating: -1 });
    
    // Convert times to 12-hour format for response
    const doctorsWith12HourTime = doctors.map(doctor => ({
      ...doctor.toObject(),
      availability: doctor.availability

    }));
    
    res.json(doctorsWith12HourTime);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update doctor rating (usually called from reviews service)
export const updateDoctorRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, totalReviews } = req.body;
    
    const doctor = await Doctor.findById(id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    
    doctor.rating = rating;
    doctor.totalReviews = totalReviews;
    await doctor.save();
    
    res.json({ 
      message: "Rating updated successfully", 
      doctor: { rating: doctor.rating, totalReviews: doctor.totalReviews }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};