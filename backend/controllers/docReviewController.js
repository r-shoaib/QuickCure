import Review from "../models/docReview.models.js";
import Doctor from "../models/doctors.model.js";

// ➤ Get reviews by doctor
export const getDoctorReviews = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const reviews = await Review.find({ doctor: doctorId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

// ➤ Add new review
export const addReview = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { 
      patientName = "Anonymous Patient", 
      rating, 
      comment, 
      tags, 
      consultationType, 
      userId,
      patientEmail 
    } = req.body;

    // Validate required fields
    if (!rating || !comment) {
      return res.status(400).json({ 
        message: "Rating and comment are required" 
      });
    }

    // Create review
    const reviewData = {
      doctor: doctorId,
      patientName,
      rating,
      comment,
      tags: tags || [],
      consultationType: consultationType || "Video Consultation",
      patientEmail: patientEmail || ""
    };

    // Add user ID if provided
    if (userId) {
      reviewData.user = userId;
    }

    const review = await Review.create(reviewData);

    // Update doctor rating
    const reviews = await Review.find({ doctor: doctorId });
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    await Doctor.findByIdAndUpdate(doctorId, {
      rating: avgRating,
      totalReviews: reviews.length,
    });

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      review,
    });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Failed to add review" });
  }
};

// ➤ UPDATE review - ADD THIS NEW FUNCTION
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { 
      rating, 
      comment, 
      tags, 
      consultationType,
      patientName,
      patientEmail,
      userId,
      doctorId 
    } = req.body;

    console.log("Update request received:", { reviewId, rating, comment, tags, patientEmail, userId });

    // Find the review
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({ 
        success: false,
        message: "Review not found" 
      });
    }

    // Check if user owns this review
    const currentUserEmail = patientEmail?.toLowerCase().trim();
    const reviewEmail = review.patientEmail?.toLowerCase().trim();
    const currentUserId = userId?.toString();
    const reviewUserId = review.user?.toString();

    let isAuthorized = false;
    
    // Check by email
    if (currentUserEmail && reviewEmail && currentUserEmail === reviewEmail) {
      console.log("Authorization: Email matches");
      isAuthorized = true;
    }
    
    // Check by user ID
    if (!isAuthorized && currentUserId && reviewUserId && currentUserId === reviewUserId) {
      console.log("Authorization: User ID matches");
      isAuthorized = true;
    }
    
    // Check by name (fallback)
    if (!isAuthorized && patientName && review.patientName && 
        patientName.toLowerCase().trim() === review.patientName.toLowerCase().trim()) {
      console.log("Authorization: Name matches");
      isAuthorized = true;
    }

    if (!isAuthorized) {
      console.log("Authorization failed for review:", reviewId);
      return res.status(403).json({ 
        success: false,
        message: "You can only edit your own reviews",
        debug: {
          reviewEmail: reviewEmail,
          providedEmail: currentUserEmail,
          reviewUserId: reviewUserId,
          providedUserId: currentUserId
        }
      });
    }

    // Update review fields
    if (rating) review.rating = rating;
    if (comment) review.comment = comment;
    if (tags) review.tags = tags;
    if (consultationType) review.consultationType = consultationType;
    
    // Save updated review
    await review.save();

    // Update doctor's average rating
    const doctor = await Doctor.findById(review.doctor);
    if (doctor) {
      const allReviews = await Review.find({ doctor: review.doctor });
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;
      
      doctor.rating = averageRating;
      doctor.totalReviews = allReviews.length;
      await doctor.save();
    }

    console.log("Review updated successfully:", reviewId);

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: review
    });

  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update review",
      error: error.message 
    });
  }
};

// ➤ Delete review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userId, doctorId, userRole = 'patient', userEmail, userName } = req.body;

    console.log("Delete request received:", { reviewId, userId, doctorId, userEmail, userName });

    // Find the review
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    console.log("Found review:", {
      id: review._id,
      patientName: review.patientName,
      patientEmail: review.patientEmail,
      userId: review.user
    });

    // Check authorization with multiple methods
    let isAuthorized = false;
    
    // Method 1: Check if user ID matches review.user
    if (userId && review.user && review.user.toString() === userId) {
      console.log("Authorization: User ID matches");
      isAuthorized = true;
    }
    
    // Method 2: Check if email matches
    if (!isAuthorized && userEmail && review.patientEmail && 
        review.patientEmail.toLowerCase() === userEmail.toLowerCase()) {
      console.log("Authorization: Email matches");
      isAuthorized = true;
    }
    
    // Method 3: Check if name matches
    if (!isAuthorized && userName && review.patientName && 
        review.patientName.toLowerCase() === userName.toLowerCase()) {
      console.log("Authorization: Name matches");
      isAuthorized = true;
    }

    // Method 4: If no user ID is set in review, allow deletion by anyone (for testing)
    // REMOVE THIS IN PRODUCTION - only for debugging
    if (!isAuthorized && !review.user && !review.patientEmail) {
      console.log("Authorization: No user identifier in review - allowing for testing");
      isAuthorized = true;
    }

    if (!isAuthorized) {
      console.log("Authorization failed for review:", reviewId);
      return res.status(403).json({ 
        message: "Not authorized to delete this review",
        debug: {
          reviewUserId: review.user,
          reviewEmail: review.patientEmail,
          reviewName: review.patientName,
          providedUserId: userId,
          providedEmail: userEmail,
          providedName: userName
        }
      });
    }

    // Delete the review
    await Review.findByIdAndDelete(reviewId);

    // Update doctor rating after deletion
    const reviews = await Review.find({ doctor: review.doctor });
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    await Doctor.findByIdAndUpdate(review.doctor, {
      rating: avgRating,
      totalReviews: reviews.length,
    });

    console.log("Review deleted successfully:", reviewId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Failed to delete review" });
  }
};