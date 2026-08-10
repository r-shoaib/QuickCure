import Lab from "../models/lab.model.js";


export const getLabs = async (req, res) => {
  try {
    const labs = await Lab.find().populate("userId", "name email");
    res.json(labs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching labs" });
  }
};

// READ SINGLE LAB
export const getLabById = async (req, res) => {
  try {
    const lab = await Lab.findById(req.params.id);
    res.json(lab);
  } catch {
    res.status(404).json({ message: "Lab not found" });
  }
};


// UPDATE LAB
export const updateLab = async (req, res) => {
  try {
    const { name, branches, discount, serviceCities } = req.body;
    
    // Prepare update data
    const updateData = {
      name,
      branches,
      discount,
    };
    
    // Handle serviceCities - accept both JSON string and array
    if (serviceCities) {
      try {
        updateData.serviceCities = typeof serviceCities === 'string' 
          ? JSON.parse(serviceCities) 
          : serviceCities;
      } catch (e) {
        updateData.serviceCities = [serviceCities];
      }
    }
    
    // If a new logo file is uploaded, add it to update data
    if (req.file) {
      updateData.logo = req.file.filename;
      
      // Optional: Delete old logo file if exists
      const oldLab = await Lab.findById(req.params.id);
      if (oldLab && oldLab.logo) {
        const fs = require('fs');
        const path = require('path');
        const oldLogoPath = path.join(__dirname, '../uploads', oldLab.logo);
        
        // Check if file exists and delete it
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
    }
    
    // Find and update the lab
    const lab = await Lab.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    
    if (!lab) {
      return res.status(404).json({ message: "Lab not found" });
    }
    
    res.json(lab);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Error updating lab", error: error.message });
  }
};
// DELETE LAB
export const deleteLab = async (req, res) => {
  try {
    await Lab.findByIdAndDelete(req.params.id);
    res.json({ message: "Lab deleted successfully" });
  } catch {
    res.status(500).json({ message: "Error deleting lab" });
  }
};








export const createLab = async (req, res) => {
  try {
    const { name, branches, discount, serviceCities } = req.body;

    const logo = req.file ? req.file.filename : null;

    // Parse serviceCities if sent as JSON string
    let cities = [];
    if (serviceCities) {
      try {
        cities = typeof serviceCities === 'string' 
          ? JSON.parse(serviceCities) 
          : serviceCities;
      } catch (e) {
        cities = [serviceCities];
      }
    }

    const lab = await Lab.create({
      name,
      branches,
      discount,
      logo,
      serviceCities: cities,
    });

    res.status(201).json({
      success: true,
      message: "Lab created successfully",
      data: lab,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

