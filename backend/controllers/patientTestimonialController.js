// controllers/patientTestimonialController.js
import PatientTestimonial from '../models/PatientTestimonial.js';

// Get all patient testimonials (latest first, limit to 6)
export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await PatientTestimonial.find()
      .sort({ createdAt: -1 })
      .limit(6);
    
    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching testimonials',
      error: error.message
    });
  }
};

// Create a new patient testimonial
export const createTestimonial = async (req, res) => {
  try {
    const { name, rating, comment } = req.body;

    if (!name || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, rating, and comment'
      });
    }

    const testimonial = await PatientTestimonial.create({
      name,
      rating,
      comment
    });

    res.status(201).json({
      success: true,
      data: testimonial,
      message: 'Testimonial submitted successfully!'
    });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error submitting testimonial',
      error: error.message
    });
  }
};

// Get average rating for patient testimonials
export const getAverageRating = async (req, res) => {
  try {
    const result = await PatientTestimonial.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalTestimonials: { $sum: 1 }
        }
      }
    ]);

    const average = result.length > 0 ? result[0].averageRating : 0;
    const total = result.length > 0 ? result[0].totalTestimonials : 0;

    res.status(200).json({
      success: true,
      averageRating: parseFloat(average.toFixed(1)),
      totalTestimonials: total
    });
  } catch (error) {
    console.error('Error getting average rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating average rating'
    });
  }
};

// Delete a testimonial (optional)
export const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await PatientTestimonial.findByIdAndDelete(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting testimonial'
    });
  }
};