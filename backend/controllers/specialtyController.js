import { Specialty } from "../models/specialty.model.js";

// Add Specialty
export const addSpecialty = async (req, res) => {
  try {
    const { name, desc, doctors, link } = req.body;

    const icon = req.file ? "/uploads/" + req.file.filename : null;

    const specialty = new Specialty({
      name,
      desc,
      doctors,
      link,
      icon,
    });

    await specialty.save();

    res.status(201).json({
      message: "Specialty added successfully",
      specialty,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Specialties
export const getSpecialties = async (req, res) => {
  try {
    const specialties = await Specialty.find().sort({ name: 1 });
    res.status(200).json(specialties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Specialty
export const getSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty)
      return res.status(404).json({ message: "Specialty not found" });

    res.status(200).json(specialty);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Specialty
export const deleteSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.findByIdAndDelete(req.params.id);
    if (!specialty)
      return res.status(404).json({ message: "Specialty not found" });

    res.status(200).json({ message: "Specialty deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//update Specialty
export const updateSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(specialty);
  } catch {
    res.status(500).json({ message: "Error updating specialty" });
  }
};
