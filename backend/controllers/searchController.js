import Doctor from "../models/doctors.model.js";
import Lab from "../models/lab.model.js";
import Pharmacy from "../models/Pharmacy.js";


// @desc    Get search suggestions
// @route   GET /api/search/suggestions
// @access  Public
export const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 1) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const searchRegex = new RegExp(query.trim(), "i");
    const suggestions = [];

    // Get doctor suggestions
    try {
      const doctors = await Doctor.find({
        isActive: true,
        $or: [
          { name: { $regex: searchRegex } },
          { speciality: { $regex: searchRegex } }
        ]
      })
      .select('name speciality')
      .limit(5);
      
      doctors.forEach(doctor => {
        suggestions.push({
          text: doctor.name,
          type: 'doctor',
          id: doctor._id,
          speciality: doctor.speciality
        });
      });
    } catch (error) {
      console.error('Error getting doctor suggestions:', error);
    }

    // Get lab suggestions
    try {
      const labs = await Lab.find({
        name: { $regex: searchRegex }
      })
      .select('name')
      .limit(5);
      
      labs.forEach(lab => {
        suggestions.push({
          text: lab.name,
          type: 'lab',
          id: lab._id
        });
      });
    } catch (error) {
      console.error('Error getting lab suggestions:', error);
    }

    // Get pharmacy suggestions
    try {
      const pharmacies = await Pharmacy.find({
        status: 'approved',
        name: { $regex: searchRegex }
      })
      .select('name city')
      .limit(5);
      
      pharmacies.forEach(pharmacy => {
        suggestions.push({
          text: pharmacy.name,
          type: 'pharmacy',
          id: pharmacy._id,
          city: pharmacy.city
        });
      });
    } catch (error) {
      console.error('Error getting pharmacy suggestions:', error);
    }

    // Remove duplicates and sort
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.text.toLowerCase() === suggestion.text.toLowerCase())
    );

    res.status(200).json({
      success: true,
      query: query.trim(),
      suggestions: uniqueSuggestions.slice(0, 10) // Limit to 10 suggestions
    });
  } catch (error) {
    console.error('Error in getSearchSuggestions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

export const unifiedSearch = async (req, res) => {
  try {
    const { query, type } = req.query;
    
    console.log('=== SEARCH REQUEST ===');
    console.log('Query:', query);
    console.log('Type:', type);
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long"
      });
    }

    const searchRegex = new RegExp(query.trim(), "i");
    console.log('Search regex:', searchRegex);
    
    const results = {
      doctors: [],
      labs: [],
      pharmacies: []
    };
    
    // Initialize error tracking
    const errors = [];

    // Search doctors if type is 'all' or 'doctors'
    if (!type || type === 'doctors' || type === 'all') {
      try {
        console.log('Searching doctors...');
        const doctors = await Doctor.find({
          isActive: true,
          $or: [
            { name: { $regex: searchRegex } },
            { speciality: { $regex: searchRegex } },
            { qualification: { $regex: searchRegex } }
          ]
        })
        .select('name speciality rating fee experience image qualification')
        .sort({ rating: -1 })
        .limit(10);
        
        console.log('Found doctors:', doctors.length);
        
        results.doctors = doctors.map(doctor => ({
          id: doctor._id,
          name: doctor.name,
          speciality: doctor.speciality,
          rating: doctor.rating,
          fee: doctor.fee,
          experience: doctor.experience,
          image: doctor.image,
          qualification: doctor.qualification,
          type: 'doctor'
        }));
      } catch (error) {
        console.error('Error searching doctors:', error);
        errors.push(`Doctors: ${error.message}`);
      }
    }

    // Search labs if type is 'all' or 'labs'
    if (!type || type === 'labs' || type === 'all') {
      try {
        console.log('Searching labs...');
        const labs = await Lab.find({
          $or: [
            { name: { $regex: searchRegex } },
            { branches: { $regex: searchRegex } }
          ]
        })
        .populate("userId", "name email")
        .limit(10);
        
        console.log('Found labs:', labs.length);
        
        results.labs = labs.map(lab => ({
          id: lab._id,
          name: lab.name,
          branches: lab.branches,
          discount: lab.discount,
          logo: lab.logo,
          type: 'lab'
        }));
      } catch (error) {
        console.error('Error searching labs:', error);
        errors.push(`Labs: ${error.message}`);
      }
    }

    // Search pharmacies if type is 'all' or 'pharmacies'
    if (!type || type === 'pharmacies' || type === 'all') {
      try {
        console.log('Searching pharmacies...');
        const pharmacies = await Pharmacy.find({
          status: 'approved',
          $or: [
            { name: { $regex: searchRegex } },
            { address: { $regex: searchRegex } },
            { city: { $regex: searchRegex } }
          ]
        })
        .select('name address city rating deliveryTime phone image open')
        .sort({ rating: -1 })
        .limit(10);
        
        console.log('Found pharmacies:', pharmacies.length);
        
        results.pharmacies = pharmacies.map(pharmacy => ({
          id: pharmacy._id,
          name: pharmacy.name,
          address: pharmacy.address,
          city: pharmacy.city,
          rating: pharmacy.rating,
          deliveryTime: pharmacy.deliveryTime,
          phone: pharmacy.phone,
          image: pharmacy.image,
          open: pharmacy.open,
          type: 'pharmacy'
        }));
      } catch (error) {
        console.error('Error searching pharmacies:', error);
        errors.push(`Pharmacies: ${error.message}`);
      }
    }

    const totalResults = results.doctors.length + results.labs.length + results.pharmacies.length;

    console.log('=== SEARCH RESULTS ===');
    console.log('Total results:', totalResults);
    console.log('Doctors:', results.doctors.length);
    console.log('Labs:', results.labs.length);
    console.log('Pharmacies:', results.pharmacies.length);
    
    if (errors.length > 0) {
      console.warn('Search errors:', errors);
    }

    res.status(200).json({
      success: true,
      query: query.trim(),
      totalResults,
      results
    });
  } catch (error) {
    console.error('=== SEARCH ERROR ===');
    console.error('Error in unified search:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

export default { unifiedSearch, getSearchSuggestions };
