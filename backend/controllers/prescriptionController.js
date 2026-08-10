import Prescription from "../models/Prescription.js";
import Doctor from "../models/doctors.model.js";

// Create a new prescription
export const createPrescription = async (req, res) => {
  try {
    const {
      doctorId,
      patientName,
      patientAge,
      patientGender,
      patientEmail,
      patientPhone,
      medicines,
      diagnosis,
      notes,
      followUpDate
    } = req.body;

    if (!doctorId || !patientName || !medicines || medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID, patient name, and at least one medicine are required"
      });
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }

    const prescription = new Prescription({
      doctor: doctorId,
      patientName: patientName.trim(),
      patientAge: patientAge ? parseInt(patientAge) : undefined,
      patientGender: patientGender || undefined,
      patientEmail: patientEmail || undefined,
      patientPhone: patientPhone || undefined,
      medicines: medicines.map(m => ({
        name: m.name,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        instructions: m.instructions || ''
      })),
      diagnosis: diagnosis || undefined,
      notes: notes || undefined,
      followUpDate: followUpDate || undefined
    });

    await prescription.save();

    res.status(201).json({
      success: true,
      message: "Prescription created successfully",
      data: prescription
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create prescription",
      error: error.message
    });
  }
};

// Upload a prescription file and attach to an existing prescription
export const uploadPrescriptionFile = async (req, res) => {
  try {
    const { prescriptionId, notes } = req.body;

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: "Prescription ID is required"
      });
    }

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found"
      });
    }

    let fileUrl = null;
    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
      prescription.fileUrl = fileUrl;
    }

    if (notes) {
      prescription.notes = notes;
    }

    await prescription.save();

    res.json({
      success: true,
      message: "Prescription file uploaded successfully",
      data: prescription
    });
  } catch (error) {
    console.error('Error uploading prescription file:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload prescription file",
      error: error.message
    });
  }
};

// Get prescriptions for a doctor
export const getDoctorPrescriptions = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID is required"
      });
    }

    const prescriptions = await Prescription.find({ doctor: doctorId })
      .sort({ prescribedDate: -1 })
      .limit(50);

    res.json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions"
    });
  }
};

// Get prescriptions by patient phone
export const getPrescriptionsByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    const prescriptions = await Prescription.find({ patientPhone: phone })
      .populate('doctor', 'name speciality')
      .sort({ prescribedDate: -1 })
      .limit(20);

    res.json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions"
    });
  }
};

// Get single prescription by ID
export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await Prescription.findById(id)
      .populate('doctor', 'name speciality');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found"
      });
    }

    res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescription"
    });
  }
};

// Update prescription
export const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      medicines,
      diagnosis,
      notes,
      followUpDate
    } = req.body;

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found"
      });
    }

    if (patientName) prescription.patientName = patientName.trim();
    if (patientAge) prescription.patientAge = parseInt(patientAge);
    if (patientGender) prescription.patientGender = patientGender;
    if (patientPhone) prescription.patientPhone = patientPhone;
    if (medicines && medicines.length > 0) {
      prescription.medicines = medicines.map(m => ({
        name: m.name,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        instructions: m.instructions || ''
      }));
    }
    if (diagnosis !== undefined) prescription.diagnosis = diagnosis;
    if (notes !== undefined) prescription.notes = notes;
    if (followUpDate !== undefined) prescription.followUpDate = followUpDate;

    await prescription.save();

    res.json({
      success: true,
      message: "Prescription updated successfully",
      data: prescription
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update prescription",
      error: error.message
    });
  }
};

// Get prescriptions by patient email (for user dashboard)
export const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientEmail } = req.params;

    if (!patientEmail) {
      return res.status(400).json({
        success: false,
        message: "Patient email is required"
      });
    }

    const prescriptions = await Prescription.find({
      $or: [
        { patientEmail: patientEmail.toLowerCase() },
        { patientPhone: patientEmail },
        { patientName: { $regex: patientEmail.split('@')[0], $options: 'i' } }
      ]
    })
      .populate('doctor', 'name speciality')
      .sort({ prescribedDate: -1 })
      .limit(50);

    res.json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions"
    });
  }
};

// Delete prescription
export const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await Prescription.findByIdAndDelete(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found"
      });
    }

    res.json({
      success: true,
      message: "Prescription deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete prescription"
    });
  }
};
