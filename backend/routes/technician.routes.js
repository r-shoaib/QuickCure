import express from "express";
import Technician from "../models/technician.model.js";
import Booking from "../models/testBooking.models.js";
import MagicLink from "../models/magicLink.model.js";
import SampleCollection from "../models/sampleCollection.model.js";
import { sendMail } from "../utils/sendMail.js";

const router = express.Router();

// GET /api/technicians/lab/:labId - Get all technicians for a lab
router.get("/lab/:labId", async (req, res) => {
  try {
    const technicians = await Technician.find({ labId: req.params.labId }).sort("-createdAt");
    res.json(technicians);
  } catch (error) {
    res.status(500).json({ message: "Error fetching technicians", error: error.message });
  }
});

// GET /api/technicians/lab/:labId/city/:city - Get technicians by city
router.get("/lab/:labId/city/:city", async (req, res) => {
  try {
    const technicians = await Technician.find({ 
      labId: req.params.labId, 
      city: req.params.city,
      isActive: true,
      availability: 'available'
    });
    res.json(technicians);
  } catch (error) {
    res.status(500).json({ message: "Error fetching technicians", error: error.message });
  }
});

// POST /api/technicians - Create a technician
router.post("/", async (req, res) => {
  try {
    const technician = await Technician.create(req.body);
    res.status(201).json(technician);
  } catch (error) {
    res.status(500).json({ message: "Error creating technician", error: error.message });
  }
});

// PUT /api/technicians/:id - Update technician
router.put("/:id", async (req, res) => {
  try {
    const technician = await Technician.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!technician) return res.status(404).json({ message: "Technician not found" });
    res.json(technician);
  } catch (error) {
    res.status(500).json({ message: "Error updating technician", error: error.message });
  }
});

// DELETE /api/technicians/:id - Delete technician
router.delete("/:id", async (req, res) => {
  try {
    await Technician.findByIdAndDelete(req.params.id);
    res.json({ message: "Technician deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting technician", error: error.message });
  }
});

// POST /api/technicians/:id/assign - Assign technician to booking + create sample collection
router.post("/:id/assign", async (req, res) => {
  try {
    const { bookingId } = req.body;
    const technician = await Technician.findById(req.params.id);
    if (!technician) return res.status(404).json({ message: "Technician not found" });

    const booking = await Booking.findById(bookingId).populate('tests');
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // CHECK: Technician daily limit (max 6 collections per day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAssignmentsCount = await Booking.countDocuments({
      assignedTechnician: technician._id,
      bookingStatus: { $in: ['assigned', 'sample_collected', 'in_lab', 'report_ready'] },
      assignedAt: { $gte: todayStart, $lte: todayEnd }
    });

    if (todayAssignmentsCount >= 6) {
      return res.status(400).json({ 
        message: `Daily limit reached. ${technician.name} already has ${todayAssignmentsCount} assignments today. Maximum is 6 samples per day.` 
      });
    }

    // Update booking with assigned technician
    booking.assignedTechnician = technician._id;
    booking.bookingStatus = 'assigned';
    booking.assignedAt = new Date();
    await booking.save();

    // Add booking to technician's assigned list
    if (!technician.assignedBookings.includes(bookingId)) {
      technician.assignedBookings.push(bookingId);
      technician.availability = 'busy';
      await technician.save();
    }

    // Create sample collection record for this booking & technician
    const samples = (booking.tests || []).map(test => ({
      testId: test._id,
      sampleType: 'blood',
      isCollected: false
    }));

    const existingCollection = await SampleCollection.findOne({
      bookingId: booking._id,
      status: { $in: ['scheduled', 'assigned', 'in_progress'] }
    });

    let collection;
    if (existingCollection) {
      existingCollection.assignedCollector = {
        name: technician.name,
        contact: technician.phone,
        employeeId: technician._id.toString()
      };
      existingCollection.status = 'assigned';
      collection = await existingCollection.save();
    } else {
      collection = await SampleCollection.create({
        bookingId: booking._id,
        labId: booking.lab,
        scheduledDate: booking.appointmentDetails?.preferredDate || new Date(),
        scheduledTimeSlot: 'morning',
        collectionAddress: booking.patientDetails?.address || 'Address not provided',
        samples,
        status: 'assigned',
        assignedCollector: {
          name: technician.name,
          contact: technician.phone,
          employeeId: technician._id.toString()
        }
      });
    }

    // Generate magic link (used as auth token)
    const magicLink = await MagicLink.create({
      technician: technician._id,
      booking: bookingId,
      labId: booking.lab,
    });

    const apiBase = process.env.API_URL || 'http://localhost:5000';
    const markCollectedUrl = `${apiBase}/api/technicians/mark-collected/${magicLink.token}`;
    const markInLabUrl = `${apiBase}/api/technicians/mark-inlab/${magicLink.token}`;
    const markDeliveredUrl = `${apiBase}/api/technicians/mark-delivered/${magicLink.token}`;

    // Fetch today's schedule for the technician
    const todayStartSchedule = new Date();
    todayStartSchedule.setHours(0, 0, 0, 0);
    const todayEndSchedule = new Date();
    todayEndSchedule.setHours(23, 59, 59, 999);

    const todaysSchedule = await Booking.find({
      assignedTechnician: technician._id,
      assignedAt: { $gte: todayStartSchedule, $lte: todayEndSchedule },
      bookingStatus: { $in: ['assigned', 'sample_collected', 'in_lab', 'report_ready'] }
    }).sort('assignedAt');

    const scheduleRows = todaysSchedule.map((b, index) => {
      const isNew = b._id.toString() === booking._id.toString();
      const statusLabel = b.bookingStatus.replace(/_/g, ' ');
      return `
        <tr style="background: ${isNew ? '#e6fffa' : (index % 2 === 0 ? '#f8fafc' : '#ffffff')};">
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${index + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${b.patientDetails?.name || 'N/A'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-transform: capitalize;">${statusLabel}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${b.appointmentDetails?.preferredDate ? new Date(b.appointmentDetails.preferredDate).toLocaleDateString('en-GB') : 'N/A'}</td>
        </tr>
      `;
    }).join('');

    const usedSlots = todaysSchedule.length;
    const remainingSlots = Math.max(0, 6 - usedSlots);

    // Send email to technician
    if (technician.email) {
      try {
        const patientName = booking.patientDetails?.name || 'Patient';
        const patientAddress = booking.patientDetails?.address || 'Address not provided';
        const patientMobile = booking.patientDetails?.mobile || 'N/A';
        const appointmentDate = booking.appointmentDetails?.preferredDate 
          ? new Date(booking.appointmentDetails.preferredDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'Not specified';
        const testNames = (booking.tests || []).map(t => t.name).join(', ');

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2c6774, #1e4e56); padding: 25px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">👨‍🔬 New Collection Task</h1>
            </div>
            
            <div style="background: #f8fafc; padding: 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #475569; font-size: 15px;">Salam <strong>${technician.name}</strong>,</p>
              <p style="color: #475569;">A new sample collection has been assigned to you.</p>
              
              <div style="background: white; padding: 18px; border-radius: 10px; margin: 18px 0; border-left: 4px solid #2c6774;">
                <h3 style="color: #2c6774; margin: 0 0 12px 0; font-size: 15px;">📋 Collection Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 5px 0; color: #64748b; width: 100px;">Patient</td><td style="padding: 5px 0; font-weight: 600;">${patientName}</td></tr>
                  <tr><td style="padding: 5px 0; color: #64748b;">Contact</td><td style="padding: 5px 0;">${patientMobile}</td></tr>
                  <tr><td style="padding: 5px 0; color: #64748b;">Address</td><td style="padding: 5px 0;">${patientAddress}</td></tr>
                  <tr><td style="padding: 5px 0; color: #64748b;">Date</td><td style="padding: 5px 0;">${appointmentDate}</td></tr>
                  <tr><td style="padding: 5px 0; color: #64748b;">Tests</td><td style="padding: 5px 0;">${testNames}</td></tr>
                </table>
              </div>

              <div style="background: white; padding: 18px; border-radius: 10px; margin: 18px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #10b981; margin: 0 0 12px 0; font-size: 15px;">📊 Today's Progress — ${usedSlots} of 6 slots used</h3>
                <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
                  <div style="background: ${remainingSlots > 0 ? '#10b981' : '#ef4444'}; height: 100%; width: ${(usedSlots / 6) * 100}%; border-radius: 4px;"></div>
                </div>
                <p style="margin: 0; color: #475569; font-size: 13px;">${remainingSlots > 0 ? `${remainingSlots} slot(s) remaining today` : 'Daily limit reached'}</p>
              </div>

              ${todaysSchedule.length > 0 ? `
              <div style="background: white; padding: 18px; border-radius: 10px; margin: 18px 0; border-left: 4px solid #8b5cf6;">
                <h3 style="color: #8b5cf6; margin: 0 0 12px 0; font-size: 15px;">🗓️ All Today's Tasks (${todaysSchedule.length})</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: #f1f5f9;">
                      <th style="padding: 8px; text-align: left; color: #64748b; font-size: 11px;">#</th>
                      <th style="padding: 8px; text-align: left; color: #64748b; font-size: 11px;">Patient</th>
                      <th style="padding: 8px; text-align: left; color: #64748b; font-size: 11px;">Status</th>
                      <th style="padding: 8px; text-align: left; color: #64748b; font-size: 11px;">Date</th>
                    </tr>
                  </thead>
                  <tbody>${scheduleRows}</tbody>
                </table>
              </div>` : ''}

              <div style="background: white; padding: 18px; border-radius: 10px; margin: 18px 0; border: 2px solid #2c6774;">
                <h3 style="color: #2c6774; margin: 0 0 15px 0; font-size: 15px;">✅ Quick Actions — Just Click to Update</h3>
                <p style="color: #475569; font-size: 13px; margin-bottom: 15px;">Click a button below to update status directly — no login needed:</p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <a href="${markCollectedUrl}" style="display: block; background: #0d9488; color: white; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; text-align: center; box-shadow: 0 4px 12px rgba(13,148,136,0.3);">🧪 Sample Collected</a>
                  <a href="${markInLabUrl}" style="display: block; background: #6366f1; color: white; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; text-align: center; box-shadow: 0 4px 12px rgba(99,102,241,0.3);">🔬 Received in Lab</a>
                  <a href="${markDeliveredUrl}" style="display: block; background: #16a34a; color: white; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; text-align: center; box-shadow: 0 4px 12px rgba(22,163,74,0.3);">📨 Report Delivered</a>
                </div>
              </div>
              
              <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin: 15px 0; border: 1px solid #ffeaa7;">
                <p style="color: #856404; margin: 0; font-size: 12px;">
                  ⏰ Links expire in 48 hours. Click in order: Collected → In Lab → Delivered
                </p>
              </div>
            </div>
            
            <div style="text-align: center; padding: 15px; color: #94a3b8; font-size: 11px;">
              <p>QuickCure Healthcare System — Auto-generated email</p>
            </div>
          </div>
        `;

        await sendMail(
          technician.email,
          `🧪 New Collection Task - ${booking.patientDetails?.name || 'Patient'} - QuickCure`,
          emailHtml
        );
        console.log(`Collection email sent to ${technician.email}`);
      } catch (emailError) {
        console.error('Failed to send email to technician:', emailError);
      }
    }

    res.json({ 
      success: true, 
      message: "Technician assigned successfully. Email sent with quick action buttons.",
      booking,
      technician,
      collection,
      magicLink: markCollectedUrl
    });
  } catch (error) {
    console.error("===== ASSIGN TECHNICIAN ERROR =====");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.errors) {
      console.error("Validation errors:", JSON.stringify(error.errors));
    }
    if (error.code) {
      console.error("Error code:", error.code);
    }
    console.error("===================================");
    res.status(500).json({ 
      message: error.message || "Error assigning technician",
      error: error.message 
    });
  }
});

// GET /api/technicians/magic-link/:token - Access via magic link (no auth needed)
router.get("/magic-link/:token", async (req, res) => {
  try {
    const magicLink = await MagicLink.findOne({ 
      token: req.params.token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).populate('technician').populate('booking');

    if (!magicLink) {
      return res.status(404).json({ message: "Invalid or expired link" });
    }

    const booking = await Booking.findById(magicLink.booking._id)
      .populate('tests')
      .populate('lab', 'name');

    const collection = await SampleCollection.findOne({ bookingId: booking._id })
      .populate('samples.testId', 'name');

    res.json({ 
      success: true, 
      technician: magicLink.technician,
      booking,
      collection,
      token: magicLink.token
    });
  } catch (error) {
    res.status(500).json({ message: "Error", error: error.message });
  }
});

// GET /api/technicians/mark-collected/:token - One-click: Mark sample as collected (from email)
router.get("/mark-collected/:token", async (req, res) => {
  try {
    const magicLink = await MagicLink.findOne({ 
      token: req.params.token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!magicLink) {
      return res.send(`
        <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f8fafc;">
          <div style="max-width:500px;margin:auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size:60px;margin-bottom:20px;">🔗</div>
            <h2 style="color:#ef4444;">Link Expired or Invalid</h2>
            <p style="color:#64748b;">This link has expired or already been used. Please contact the lab for a new assignment.</p>
          </div>
        </body></html>
      `);
    }

    // Update booking status
    const booking = await Booking.findByIdAndUpdate(magicLink.booking, 
      { bookingStatus: 'sample_collected', sampleCollectedAt: new Date() }, 
      { new: true }
    );

    // Update sample collection
    await SampleCollection.findOneAndUpdate(
      { bookingId: magicLink.booking },
      { status: 'collected', collectedAt: new Date(), collectedBy: magicLink.technician?.toString() }
    );

    const patientName = booking?.patientDetails?.name || 'Patient';

    res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f8fafc;">
        <div style="max-width:500px;margin:auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <div style="font-size:60px;margin-bottom:20px;">🧪</div>
          <h2 style="color:#0d9488;">Sample Collected Successfully!</h2>
          <p style="color:#64748b;font-size:16px;">Patient: <strong>${patientName}</strong></p>
          <p style="color:#64748b;">Status updated to <strong style="color:#0d9488;">Sample Collected</strong></p>
          <p style="color:#94a3b8;font-size:13px;margin-top:20px;">You can now proceed to the next step: Received in Lab</p>
          <p style="color:#94a3b8;font-size:12px;">QuickCure Healthcare System</p>
        </div>
      </body></html>
    `);
  } catch (error) {
    console.error("Mark collected error:", error);
    res.status(500).send(`<html><body style="font-family:Arial;text-align:center;padding:50px;"><h2 style="color:#ef4444;">Error</h2><p>Something went wrong. Please try again.</p></body></html>`);
  }
});

// GET /api/technicians/mark-inlab/:token - One-click: Mark as received in lab
router.get("/mark-inlab/:token", async (req, res) => {
  try {
    const magicLink = await MagicLink.findOne({ 
      token: req.params.token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!magicLink) {
      return res.send(`
        <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f8fafc;">
          <div style="max-width:500px;margin:auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size:60px;margin-bottom:20px;">🔗</div>
            <h2 style="color:#ef4444;">Link Expired or Invalid</h2>
            <p style="color:#64748b;">This link has expired or already been used.</p>
          </div>
        </body></html>
      `);
    }

    const booking = await Booking.findByIdAndUpdate(magicLink.booking, 
      { bookingStatus: 'in_lab', receivedInLabAt: new Date() }, 
      { new: true }
    );

    await SampleCollection.findOneAndUpdate(
      { bookingId: magicLink.booking },
      { status: 'delivered', deliveredAt: new Date() }
    );

    const patientName = booking?.patientDetails?.name || 'Patient';

    res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f8fafc;">
        <div style="max-width:500px;margin:auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <div style="font-size:60px;margin-bottom:20px;">🔬</div>
          <h2 style="color:#6366f1;">Sample Received in Lab!</h2>
          <p style="color:#64748b;font-size:16px;">Patient: <strong>${patientName}</strong></p>
          <p style="color:#64748b;">Status updated to <strong style="color:#6366f1;">In Lab</strong></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">QuickCure Healthcare System</p>
        </div>
      </body></html>
    `);
  } catch (error) {
    console.error("Mark inlab error:", error);
    res.status(500).send(`<html><body style="font-family:Arial;text-align:center;padding:50px;"><h2 style="color:#ef4444;">Error</h2><p>Something went wrong.</p></body></html>`);
  }
});

// GET /api/technicians/mark-delivered/:token - One-click: Mark as delivered
router.get("/mark-delivered/:token", async (req, res) => {
  try {
    const magicLink = await MagicLink.findOne({ 
      token: req.params.token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!magicLink) {
      return res.send(`
        <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f8fafc;">
          <div style="max-width:500px;margin:auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size:60px;margin-bottom:20px;">🔗</div>
            <h2 style="color:#ef4444;">Link Expired or Invalid</h2>
            <p style="color:#64748b;">This link has expired or already been used.</p>
          </div>
        </body></html>
      `);
    }

    const booking = await Booking.findByIdAndUpdate(magicLink.booking, 
      { bookingStatus: 'delivered', deliveredAt: new Date() }, 
      { new: true }
    );

    // Mark magic link as used and free up technician
    magicLink.isUsed = true;
    await magicLink.save();
    await Technician.findByIdAndUpdate(magicLink.technician, { 
      $pull: { assignedBookings: magicLink.booking },
      availability: 'available'
    });

    const patientName = booking?.patientDetails?.name || 'Patient';

    res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f8fafc;">
        <div style="max-width:500px;margin:auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <div style="font-size:60px;margin-bottom:20px;">📨</div>
          <h2 style="color:#16a34a;">Report Delivered Successfully!</h2>
          <p style="color:#64748b;font-size:16px;">Patient: <strong>${patientName}</strong></p>
          <p style="color:#64748b;">Status updated to <strong style="color:#16a34a;">Delivered</strong></p>
          <p style="color:#94a3b8;font-size:13px;margin-top:20px;">Task completed! You are now available for new assignments.</p>
          <p style="color:#94a3b8;font-size:12px;">QuickCure Healthcare System</p>
        </div>
      </body></html>
    `);
  } catch (error) {
    console.error("Mark delivered error:", error);
    res.status(500).send(`<html><body style="font-family:Arial;text-align:center;padding:50px;"><h2 style="color:#ef4444;">Error</h2><p>Something went wrong.</p></body></html>`);
  }
});

// PATCH /api/technicians/update-status/:token - Update booking status via magic link
router.patch("/update-status/:token", async (req, res) => {
  try {
    const { status } = req.body;
    const magicLink = await MagicLink.findOne({ 
      token: req.params.token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!magicLink) return res.status(404).json({ message: "Invalid or expired link" });

    const statusUpdates = {
      'sample_collected': { bookingStatus: 'sample_collected', sampleCollectedAt: new Date() },
      'in_lab': { bookingStatus: 'in_lab', receivedInLabAt: new Date() },
      'delivered': { bookingStatus: 'delivered', deliveredAt: new Date() }
    };

    const update = statusUpdates[status] || { bookingStatus: status };
    
    // Update booking status
    const booking = await Booking.findByIdAndUpdate(magicLink.booking, update, { new: true });

    // Also update sample collection status
    if (status === 'sample_collected') {
      await SampleCollection.findOneAndUpdate(
        { bookingId: magicLink.booking },
        { 
          status: 'collected', 
          collectedAt: new Date(),
          collectedBy: magicLink.technician?.toString()
        }
      );
    } else if (status === 'in_lab') {
      await SampleCollection.findOneAndUpdate(
        { bookingId: magicLink.booking },
        { status: 'delivered', deliveredAt: new Date() }
      );
    }

    if (status === 'delivered') {
      magicLink.isUsed = true;
      await magicLink.save();
      // Free up technician
      await Technician.findByIdAndUpdate(magicLink.technician, { 
        $pull: { assignedBookings: magicLink.booking },
        availability: 'available'
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
});

export default router;