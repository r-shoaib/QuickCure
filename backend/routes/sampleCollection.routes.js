import express from "express";
import SampleCollection from "../models/sampleCollection.model.js";
import Booking from "../models/testBooking.models.js";
import Patient from "../models/patient.model.js";

const router = express.Router();

// ============== LAB ROUTES ==============

// GET /collections/lab/:labId
router.get('/lab/:labId', async (req, res) => {
  try {
    const { labId } = req.params;
    const collections = await SampleCollection.find({ labId })
      .populate('patientId', 'name mobile address email')
      .populate('bookingId', 'bookingReference patientDetails')
      .populate('samples.testId', 'name')
      .sort('-scheduledDate');

    res.status(200).json({ success: true, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /collections/schedule
router.post('/schedule', async (req, res) => {
  try {
    let {
      bookingId,
      patientId,
      labId,
      scheduledDate,
      scheduledTimeSlot,
      specialInstructions,
      patientCondition,
      fastingRequired,
      fastingHours
    } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId (ID or Reference) is required' });
    }

    // Support both MongoDB ID and Booking Reference
    const query = (typeof bookingId === 'string' && bookingId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: bookingId } 
      : { bookingReference: bookingId };

    // Get booking details
    const booking = await Booking.findOne(query).populate('tests').populate('lab');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Use the actual MongoDB ID from the found booking
    const actualBookingId = booking._id;

    // If patientId is missing, try to find patient by email from booking
    if (!patientId && booking.patientDetails?.email) {
      const foundPatient = await Patient.findOne({ 
        email: booking.patientDetails.email.toLowerCase() 
      });
      if (foundPatient) patientId = foundPatient._id;
    }

    // Check if already scheduled
    const existing = await SampleCollection.findOne({
      bookingId: actualBookingId,
      status: { $in: ['scheduled', 'assigned', 'in_progress'] }
    });

    if (existing) {
      // If a collection is already scheduled, update the existing one instead of failing.
      // This fixes the error when re-scheduling or editing via the schedule endpoint.
      existing.scheduledDate = new Date(scheduledDate);
      existing.scheduledTimeSlot = scheduledTimeSlot;
      existing.patientId = patientId || existing.patientId;
      existing.specialInstructions = specialInstructions || existing.specialInstructions;
      existing.patientCondition = patientCondition || existing.patientCondition;
      existing.fastingRequired = fastingRequired !== undefined ? fastingRequired : existing.fastingRequired;
      existing.fastingHours = fastingHours || existing.fastingHours;
      
      await existing.save();
      
      const populated = await SampleCollection.findById(existing._id)
        .populate('patientId', 'name mobile address email')
        .populate('bookingId', 'bookingReference patientDetails');

      return res.status(200).json({
        success: true,
        message: 'Sample collection schedule updated successfully',
        data: populated
      });
    }

    // Create samples array from tests
    const samples = (booking.tests || []).map(test => ({
      testId: test._id,
      sampleType: 'blood',
      isCollected: false
    }));

    // Create new collection
    const sampleCollection = new SampleCollection({
      bookingId: actualBookingId,
      patientId: patientId || null, 
      labId: labId || booking.lab?._id || booking.lab, 
      scheduledDate: new Date(scheduledDate),
      scheduledTimeSlot,
      collectionAddress: booking.patientDetails?.address || 'Address not available',
      specialInstructions: specialInstructions || '',
      patientCondition: patientCondition || '',
      fastingRequired: fastingRequired || false,
      fastingHours: fastingHours || 8,
      samples,
      status: 'scheduled',
      createdBy: req.body.userId || null
    });

    const savedCollection = await sampleCollection.save();
    const populated = await SampleCollection.findById(savedCollection._id)
      .populate('patientId', 'name mobile address email')
      .populate('bookingId', 'bookingReference patientDetails');

    res.status(201).json({
      success: true,
      message: 'Sample collection scheduled successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /collections/:collectionId/assign
router.patch('/:collectionId/assign', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { collectorName, collectorContact, collectorEmployeeId } = req.body;

    // Support both MongoDB ID and Tracking ID
    const query = (typeof collectionId === 'string' && collectionId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: collectionId } 
      : { trackingId: collectionId };

    const collection = await SampleCollection.findOneAndUpdate(
      query,
      {
        assignedCollector: {
          name: collectorName,
          contact: collectorContact,
          employeeId: collectorEmployeeId
        },
        assignedAt: new Date(),
        status: 'assigned'
      },
      { new: true }
    );

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Collector assigned successfully',
      data: collection
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /collections/:collectionId/status
router.patch('/:collectionId/status', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { action, status: manualStatus } = req.body;
    
    let newStatus = manualStatus;
    if (action === 'start') newStatus = 'in_progress';
    else if (action === 'collect') newStatus = 'collected';
    else if (action === 'deliver') newStatus = 'delivered';
    else if (action === 'cancel') newStatus = 'cancelled';

    if (!newStatus) return res.status(400).json({ success: false, message: 'Status or action is required' });

    const updateData = { status: newStatus };
    
    if (newStatus === 'in_progress') updateData.startedAt = new Date();
    if (newStatus === 'collected') updateData.collectedAt = new Date();
    if (newStatus === 'delivered') updateData.deliveredAt = new Date();
    if (newStatus === 'cancelled') updateData.cancelledAt = new Date();

    // Support both MongoDB ID and Tracking ID
    const query = (typeof collectionId === 'string' && collectionId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: collectionId } 
      : { trackingId: collectionId };

    const collection = await SampleCollection.findOneAndUpdate(
      query,
      updateData,
      { new: true }
    );

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    res.status(200).json({
      success: true,
      message: `Collection ${newStatus} successfully`,
      data: collection
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Update sample collection details (General Edit)
router.put('/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { _id, trackingId, ...updateData } = req.body;

    // Ensure scheduledDate is a valid Date object if provided as a string
    if (updateData.scheduledDate) {
      updateData.scheduledDate = new Date(updateData.scheduledDate);
    }

    const query = (typeof collectionId === 'string' && collectionId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: collectionId } 
      : { trackingId: collectionId };

    const collection = await SampleCollection.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('patientId', 'name mobile address email')
     .populate('bookingId', 'bookingReference patientDetails');

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    res.status(200).json({ success: true, message: 'Collection updated successfully', data: collection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Update individual sample data (e.g. marking a specific test's sample as collected)
router.patch('/:collectionId/samples/:sampleId', async (req, res) => {
  try {
    const { collectionId, sampleId } = req.params;
    const updateFields = req.body; // e.g., { isCollected: true, containerType: 'Red Top' }

    const query = (typeof collectionId === 'string' && collectionId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: collectionId } 
      : { trackingId: collectionId };

    const collection = await SampleCollection.findOne(query);
    if (!collection) return res.status(404).json({ success: false, message: 'Collection not found' });

    const sample = collection.samples.id(sampleId);
    if (!sample) return res.status(404).json({ success: false, message: 'Sample not found' });

    Object.assign(sample, updateFields);
    
    // Auto-update collection status if all samples are now collected
    const allCollected = collection.samples.every(s => s.isCollected);
    if (allCollected && collection.status === 'in_progress') {
      collection.status = 'collected';
      collection.collectedAt = new Date();
    }

    await collection.save();
    res.status(200).json({ success: true, data: collection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Delete entire sample collection
router.delete('/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const query = (typeof collectionId === 'string' && collectionId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: collectionId } 
      : { trackingId: collectionId };

    const deleted = await SampleCollection.findOneAndDelete(query);
    if (!deleted) return res.status(404).json({ success: false, message: 'Collection not found' });

    res.status(200).json({ success: true, message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /collections/:collectionId
router.get('/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;

    // Support both MongoDB ID and Tracking ID
    const query = (typeof collectionId === 'string' && collectionId.match(/^[0-9a-fA-F]{24}$/))
      ? { _id: collectionId } 
      : { trackingId: collectionId };

    const collection = await SampleCollection.findOne(query)
      .populate('patientId', 'name mobile address email')
      .populate('bookingId', 'bookingReference tests patientDetails')
      .populate('samples.testId', 'name');

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    res.status(200).json({ success: true, data: collection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;