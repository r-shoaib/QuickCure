// routes/dashboard.js
import express from 'express';
import Booking from '../models/testBooking.models.js';
import Lab from '../models/lab.model.js';
import Test from '../models/test.model.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [
      totalLabs,
      totalTests,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      groupBookings  // ADD THIS
    ] = await Promise.all([
      Lab.countDocuments(),
      Test.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ bookingStatus: 'pending' }),
      Booking.countDocuments({ bookingStatus: 'confirmed' }),
      Booking.countDocuments({ bookingStatus: 'completed' }),
      Booking.countDocuments({ bookingStatus: 'cancelled' }),
      Booking.countDocuments({ 
        groupBooking: true,
        totalPatients: { $gt: 1 }  // Only count real groups
      })
    ]);

    // Calculate revenue from completed bookings
    const completedBookingStats = await Booking.aggregate([
      { $match: { bookingStatus: 'completed' } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalRevenue = completedBookingStats[0]?.totalRevenue || 0;

    res.json({
      totalLabs,
      totalTests,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      groupBookings,  // ADD THIS
      totalRevenue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bookings with lab and test details
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('lab', 'name logo branches')
      .populate('tests', 'name price')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { bookingStatus: status, updatedAt: new Date() },
      { new: true }
    ).populate('lab tests');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get lab performance stats
router.get('/labs/performance', async (req, res) => {
  try {
    const labStats = await Booking.aggregate([
      { $match: { bookingStatus: 'completed' } },
      { $group: {
          _id: '$lab',
          totalBookings: { $sum: 1 },
          totalTests: { $sum: { $size: '$tests' } }
        }
      },
      { $lookup: {
          from: 'labs',
          localField: '_id',
          foreignField: '_id',
          as: 'labDetails'
        }
      },
      { $unwind: '$labDetails' },
      { $project: {
          labName: '$labDetails.name',
          totalBookings: 1,
          totalTests: 1
        }
      }
    ]);

    res.json(labStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent activities
router.get('/activities', async (req, res) => {
  try {
    const recentActivities = await Promise.all([
      Lab.find().sort({ createdAt: -1 }).limit(5),
      Test.find().sort({ createdAt: -1 }).limit(5),
      Booking.find().sort({ createdAt: -1 }).limit(10)
        .populate('lab', 'name')
        .populate('tests', 'name')
    ]);

    const [recentLabs, recentTests, recentBookings] = recentActivities;

    res.json({
      recentLabs,
      recentTests,
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;