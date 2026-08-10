import Appointment from "../models/appointment.model.js";
import Doctor from "../models/doctors.model.js";
import { generateTimeSlots, to24HourFormat, to12HourFormat } from "../utils/slotGenerator.js";

// Helper function to check time overlap
const doTimeRangesOverlap = (range1, range2) => {
  const [start1, end1] = range1;
  const [start2, end2] = range2;
  return start1 < end2 && start2 < end1;
};

// Get available time slots for a doctor on specific date
export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    
    if (!doctorId || !date) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor ID and date are required" 
      });
    }
    
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD" 
      });
    }
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ 
        success: false,
        message: "Doctor not found" 
      });
    }
    
    if (!doctor.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor is not available for appointments" 
      });
    }
    
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    const availability = doctor.availability.find(
      slot => slot.day === dayName && slot.isAvailable
    );
    
    if (!availability) {
      return res.json({ 
        success: true,
        availableSlots: [],
        message: "Doctor is not available on this day" 
      });
    }
    
    const startTime24 = to24HourFormat(availability.startTime);
    const endTime24 = to24HourFormat(availability.endTime);
    const allSlots = generateTimeSlots(startTime24, endTime24, 15);
    
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $in: ['pending', 'confirmed', 'approved'] }
    }).select('timeSlot');
    
    const bookedTimeRanges = bookedAppointments.map(apt => [
      apt.timeSlot.startTime,
      apt.timeSlot.endTime
    ]);
    
    const availableSlots = allSlots.filter(slot => {
      const slotRange = [slot.startTime, slot.endTime];
      return !bookedTimeRanges.some(bookedRange => 
        doTimeRangesOverlap(slotRange, bookedRange)
      );
    });
    
    res.json({
      success: true,
      doctor: {
        name: doctor.name,
        speciality: doctor.speciality,
        fee: doctor.fee,
        image: doctor.image
      },
      date: date,
      day: dayName,
      availableSlots: availableSlots.map(slot => ({
        ...slot,
        startTime12: to12HourFormat(slot.startTime),
        endTime12: to12HourFormat(slot.endTime)
      })),
      totalSlots: availableSlots.length
    });
    
  } catch (error) {
    console.error('Error in getAvailableSlots:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch available slots"
    });
  }
};

// Book a new appointment
export const bookAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      patientName,
      phoneNo,
      email,
      age,
      gender,
      date,
      startTime,
      endTime,
      reason
    } = req.body;
    
    if (!doctorId || !patientName || !phoneNo || !date || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor ID, patient name, phone number, date, and time slot are required" 
      });
    }
    
    const phoneRegex = /^(\+92|0)?3[0-9]{9}$/;
    const cleanPhoneNo = phoneNo.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhoneNo)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid phone number format. Use Pakistani format (03XXXXXXXXX)" 
      });
    }
    
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid email format" 
        });
      }
    }
    
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid date format" 
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot book appointment for past dates" 
      });
    }
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ 
        success: false,
        message: "Doctor not found" 
      });
    }
    
    if (!doctor.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor is not available for appointments" 
      });
    }
    
    const dayName = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const availability = doctor.availability.find(
      slot => slot.day === dayName && slot.isAvailable
    );
    
    if (!availability) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor is not available on this day" 
      });
    }
    
    const doctorStartTime = to24HourFormat(availability.startTime);
    const doctorEndTime = to24HourFormat(availability.endTime);
    const requestedStartTime = to24HourFormat(startTime);
    const requestedEndTime = to24HourFormat(endTime);
    
    if (requestedStartTime < doctorStartTime || requestedEndTime > doctorEndTime) {
      return res.status(400).json({ 
        success: false,
        message: `Time slot must be between ${to12HourFormat(doctorStartTime)} and ${to12HourFormat(doctorEndTime)}` 
      });
    }
    
    const startTimeObj = new Date(`1970-01-01T${requestedStartTime}:00`);
    const endTimeObj = new Date(`1970-01-01T${requestedEndTime}:00`);
    const slotDuration = (endTimeObj - startTimeObj) / (1000 * 60);
    
    if (slotDuration !== 15) {
      return res.status(400).json({ 
        success: false,
        message: "Appointment duration must be 15 minutes" 
      });
    }
    
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      'timeSlot.startTime': requestedStartTime,
      'timeSlot.endTime': requestedEndTime,
      status: { $in: ['pending', 'confirmed', 'approved'] }
    });
    
    if (existingAppointment) {
      return res.status(409).json({ 
        success: false,
        message: "This time slot is already booked. Please choose another time." 
      });
    }
    
    const appointment = new Appointment({
      doctor: doctorId,
      patientName: patientName.trim(),
      phoneNo: cleanPhoneNo,
      email: email && email.trim() !== '' ? email.trim().toLowerCase() : undefined,
      age: age ? parseInt(age) : undefined,
      gender: gender || undefined,
      date: appointmentDate,
      timeSlot: {
        startTime: requestedStartTime,
        endTime: requestedEndTime
      },
      reason: reason || undefined,
      fee: doctor.fee,
      status: 'pending'
    });
    
    await appointment.save();
    
    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: {
        _id: appointment._id,
        id: appointment._id,
        confirmationCode: appointment.confirmationCode,
        doctor: doctor.name,
        speciality: doctor.speciality,
        patientName: appointment.patientName,
        phoneNo: appointment.phoneNo,
        email: appointment.email,
        age: appointment.age,
        gender: appointment.gender,
        date: appointment.date.toISOString().split('T')[0],
        startTime: appointment.timeSlot.startTime,
        endTime: appointment.timeSlot.endTime,
        time: `${to12HourFormat(appointment.timeSlot.startTime)} - ${to12HourFormat(appointment.timeSlot.endTime)}`,
        fee: appointment.fee,
        status: appointment.status
      }
    });
    
  } catch (error) {
    console.error('Error in bookAppointment:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false,
        message: "This time slot has just been booked by another patient. Please choose another time." 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to book appointment"
    });
  }
};

// Get appointment by confirmation code or ID
export const getAppointment = async (req, res) => {
  try {
    const { id, confirmationCode } = req.query;
    
    if (!id && !confirmationCode) {
      return res.status(400).json({ 
        success: false,
        message: "Appointment ID or confirmation code is required" 
      });
    }
    
    let appointment;
    
    if (id) {
      appointment = await Appointment.findById(id).populate('doctor', 'name speciality fee image');
    } else {
      appointment = await Appointment.findOne({ confirmationCode }).populate('doctor', 'name speciality fee image');
    }
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false,
        message: "Appointment not found" 
      });
    }
    
    res.json({
      success: true,
      appointment: {
        id: appointment._id,
        confirmationCode: appointment.confirmationCode,
        doctor: {
          name: appointment.doctor.name,
          speciality: appointment.doctor.speciality,
          fee: appointment.doctor.fee,
          image: appointment.doctor.image
        },
        patientName: appointment.patientName,
        phoneNo: appointment.phoneNo,
        email: appointment.email,
        age: appointment.age,
        gender: appointment.gender,
        date: appointment.date.toISOString().split('T')[0],
        time: `${to12HourFormat(appointment.timeSlot.startTime)} - ${to12HourFormat(appointment.timeSlot.endTime)}`,
        reason: appointment.reason,
        fee: appointment.fee,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        bookedAt: appointment.bookedAt
      }
    });
    
  } catch (error) {
    console.error('Error in getAppointment:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch appointment details" 
    });
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false,
        message: "Appointment not found" 
      });
    }
    
    if (appointment.status === 'cancelled') {
      return res.status(400).json({ 
        success: false,
        message: "Appointment is already cancelled" 
      });
    }
    
    if (appointment.status === 'completed') {
      return res.status(400).json({ 
        success: false,
        message: "Cannot cancel a completed appointment" 
      });
    }
    
    appointment.status = 'cancelled';
    if (reason && reason.trim() !== '') {
      appointment.notes = `Cancelled: ${reason.trim()}`;
    }
    await appointment.save();
    
    res.json({
      success: true,
      message: "Appointment cancelled successfully"
    });
    
  } catch (error) {
    console.error('Error in cancelAppointment:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to cancel appointment" 
    });
  }
};

// Get appointments by phone number
export const getAppointmentsByPhone = async (req, res) => {
  try {
    const { phoneNo } = req.params;
    
    if (!phoneNo) {
      return res.status(400).json({ 
        success: false,
        message: "Phone number is required" 
      });
    }
    
    const cleanPhoneNo = phoneNo.replace(/[\s\-\(\)]/g, '');
    
    const appointments = await Appointment.find({ 
      phoneNo: cleanPhoneNo,
      status: { $ne: 'cancelled' }
    })
    .populate('doctor', 'name speciality image')
    .sort({ date: -1, 'timeSlot.startTime': -1 })
    .limit(20);
    
    const formattedAppointments = appointments.map(appointment => ({
      id: appointment._id,
      confirmationCode: appointment.confirmationCode,
      doctor: {
        name: appointment.doctor.name,
        speciality: appointment.doctor.speciality,
        image: appointment.doctor.image
      },
      date: appointment.date.toISOString().split('T')[0],
      time: `${to12HourFormat(appointment.timeSlot.startTime)} - ${to12HourFormat(appointment.timeSlot.endTime)}`,
      meetLink: appointment.meetLink || '',
      status: appointment.status,
      fee: appointment.fee
    }));
    
    res.json({
      success: true,
      total: formattedAppointments.length,
      appointments: formattedAppointments
    });
    
  } catch (error) {
    console.error('Error in getAppointmentsByPhone:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch appointments" 
    });
  }
};

// Update appointment status (for admin/doctor)
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status || !['pending', 'approved', 'confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: "Valid status is required. Allowed: pending, approved, confirmed, cancelled, completed, no-show" 
      });
    }
    
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false,
        message: "Appointment not found" 
      });
    }
    
    appointment.status = status;
    if (notes && notes.trim() !== '') {
      appointment.notes = notes.trim();
    }
    
    await appointment.save();
    
    res.json({
      success: true,
      message: `Appointment status updated to ${status}`,
      appointment: {
        id: appointment._id,
        status: appointment.status,
        confirmationCode: appointment.confirmationCode
      }
    });
    
  } catch (error) {
    console.error('Error in updateAppointmentStatus:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update appointment status" 
    });
  }
};

// Get doctor's appointments (for doctor dashboard)
export const getDoctorAppointments = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, status } = req.query;
    
    if (!doctorId) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor ID is required" 
      });
    }
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ 
        success: false,
        message: "Doctor not found" 
      });
    }
    
    const query = { doctor: doctorId };
    
    if (date) {
      const selectedDate = new Date(date);
      if (!isNaN(selectedDate.getTime())) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        query.date = {
          $gte: startOfDay,
          $lt: endOfDay
        };
      }
    }
    
    if (status && ['pending', 'approved', 'confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) {
      query.status = status;
    }
    
    const appointments = await Appointment.find(query)
      .sort({ date: 1, 'timeSlot.startTime': 1 });
    
    const formattedAppointments = appointments.map(appointment => ({
      _id: appointment._id,
      id: appointment._id,
      confirmationCode: appointment.confirmationCode,
      patientName: appointment.patientName,
      phoneNo: appointment.phoneNo,
      email: appointment.email,
      age: appointment.age,
      gender: appointment.gender,
      date: appointment.date.toISOString().split('T')[0],
      appointmentDate: appointment.date.toISOString().split('T')[0],
      time: `${to12HourFormat(appointment.timeSlot.startTime)} - ${to12HourFormat(appointment.timeSlot.endTime)}`,
      appointmentTime: `${to12HourFormat(appointment.timeSlot.startTime)} - ${to12HourFormat(appointment.timeSlot.endTime)}`,
      startTime: appointment.timeSlot.startTime,
      endTime: appointment.timeSlot.endTime,
      reason: appointment.reason,
      meetLink: appointment.meetLink || '',
      status: appointment.status,
      fee: appointment.fee,
      notes: appointment.notes,
      bookedAt: appointment.bookedAt
    }));
    
    res.json({
      success: true,
      doctor: {
        name: doctor.name,
        speciality: doctor.speciality
      },
      total: formattedAppointments.length,
      appointments: formattedAppointments,
      data: formattedAppointments // For compatibility
    });
    
  } catch (error) {
    console.error('Error in getDoctorAppointments:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch doctor appointments"
    });
  }
};

// Generate a Google Meet link and send it to the patient
export const sendMeetLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { meetLink } = req.body;

    if (!meetLink) {
      return res.status(400).json({
        success: false,
        message: "Google Meet link is required"
      });
    }

    // Basic Google Meet URL validation
    if (!meetLink.includes('meet.google.com')) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Meet link. Must be a valid meet.google.com URL"
      });
    }

    const appointment = await Appointment.findById(id).populate('doctor', 'name speciality');
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Save the meet link to appointment
    appointment.meetLink = meetLink;
    await appointment.save();

    const formatDate = (dateStr) => {
      try {
        return new Date(dateStr).toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
      } catch { return dateStr; }
    };

    // Prepare email content
    if (appointment.email) {
      try {
        const { transporter } = await import('../config/email.js');
        const mailOptions = {
          from: process.env.EMAIL_FROM || 'QuickCure <noreply@quickcure.com>',
          to: appointment.email,
          subject: `Your Google Meet Link for Appointment with Dr. ${appointment.doctor.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #174047, #2c6774); padding: 30px; border-radius: 12px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">QuickCure</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">Your Telehealth Appointment</p>
              </div>
              
              <div style="padding: 30px 20px; background: #f9fafb; border-radius: 0 0 12px 12px;">
                <h2 style="color: #174047; margin-top: 0;">Virtual Consultation Invitation</h2>
                
                <p style="color: #374151; line-height: 1.6;">Dear <strong>${appointment.patientName}</strong>,</p>
                <p style="color: #374151; line-height: 1.6;">
                  Your appointment with <strong>Dr. ${appointment.doctor.name}</strong> 
                  (${appointment.doctor.speciality || 'Doctor'}) has been confirmed.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                  <h3 style="color: #174047; margin: 0 0 10px; font-size: 16px;">Appointment Details</h3>
                  <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${formatDate(appointment.date)}</p>
                  <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${appointment.timeSlot?.startTime || 'N/A'}</p>
                  <p style="margin: 5px 0; color: #374151;"><strong>Doctor:</strong> Dr. ${appointment.doctor.name}</p>
                </div>
                
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${meetLink}" 
                     style="display: inline-block; background: linear-gradient(135deg, #174047, #2c6774); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                    🎥 Join Google Meet
                  </a>
                </div>
                
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #fde68a; margin-top: 20px;">
                  <p style="color: #92400e; margin: 0; font-size: 13px;">
                    <strong>💡 Tip:</strong> Click the button above at your appointment time to join the video call. 
                    Make sure your camera and microphone are working.
                  </p>
                </div>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 25px; text-align: center;">
                  This is an automated message from QuickCure Healthcare System.
                </p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Meet link email sent to ${appointment.email}`);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return res.json({
      success: true,
      message: `Google Meet link sent successfully${appointment.email ? ' and emailed to patient' : ''}`,
      appointment: {
        _id: appointment._id,
        meetLink: appointment.meetLink
      }
    });

  } catch (error) {
    console.error('Error sending meet link:', error);
    res.status(500).json({
      success: false,
      message: "Failed to send Google Meet link"
    });
  }
};

// ========== NEW FUNCTION: Get doctor's patients (unique patients) ==========
export const getDoctorPatients = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    if (!doctorId) {
      return res.status(400).json({ 
        success: false,
        message: "Doctor ID is required" 
      });
    }
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ 
        success: false,
        message: "Doctor not found" 
      });
    }
    
    // Get all appointments for this doctor
    const appointments = await Appointment.find({ 
      doctor: doctorId,
      status: { $ne: 'cancelled' }
    }).sort({ date: -1 });
    
    // Extract unique patients
    const patientsMap = new Map();
    
    appointments.forEach(appointment => {
      const patientKey = appointment.phoneNo || appointment.email;
      
      if (!patientsMap.has(patientKey)) {
        patientsMap.set(patientKey, {
          id: appointment._id,
          name: appointment.patientName,
          contact: appointment.phoneNo,
          email: appointment.email || '',
          age: appointment.age || '',
          gender: appointment.gender || '',
          lastVisit: appointment.date.toISOString().split('T')[0],
          totalVisits: 1
        });
      } else {
        const existingPatient = patientsMap.get(patientKey);
        existingPatient.totalVisits += 1;
        
        // Update last visit if this appointment is more recent
        const currentLastVisit = new Date(existingPatient.lastVisit);
        const appointmentDate = new Date(appointment.date);
        if (appointmentDate > currentLastVisit) {
          existingPatient.lastVisit = appointment.date.toISOString().split('T')[0];
        }
      }
    });
    
    const patients = Array.from(patientsMap.values());
    
    res.json({
      success: true,
      total: patients.length,
      patients: patients,
      data: patients // For compatibility with frontend
    });
    
  } catch (error) {
    console.error('Error in getDoctorPatients:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch doctor patients"
    });
  }
};