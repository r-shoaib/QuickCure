import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

// Auth routes / user
import authRoutes from "./routes/authRoutes.js";

// Admin routes
import adminRoutes from "./routes/adminRoutes.js";

// contact route
import contactRoutes from './routes/contactRoutes.js';
import patientTestimonialRoutes from './routes/patientTestimonialRoutes.js';

// Lab routes
import labRoutes from "./routes/lab.routes.js";
import bookingRoutes from "./routes/testBooking.routes.js";
import testRoutes from "./routes/test.routes.js"
import patientRoutes from "./routes/patient.route.js";
import reportRoutes from "./routes/report.routes.js";
import sampleCollectionRoutes from "./routes/sampleCollection.routes.js"; 
import technicianRoutes from "./routes/technician.routes.js";
import technicianAuthRoutes from "./routes/technicianAuth.routes.js";

// Registration routes
import labRegistrationRoutes from "./routes/labReg.routes.js";
import doctorRegistrationRoutes from "./routes/doctor_registration.js";
import pharmacyRegistrationRoutes from './routes/pharmacyReg.routes.js';

// Pharmacy Routes
import pharmacyRoutes from "./routes/pharmacyRoutes.js";
import medicineOrderRoutes from './routes/medicineOrderRoutes.js';

// Doctors routes
import specialtyRoutes from "./routes/specialty.routes.js";
import doctorsRoutes from "./routes/doctors.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import reviewRoutes from "./routes/docReview.routes.js";

// Lab Admin routes
import labadminRoutes from "./routes/labDashboard.js";

// Pharmacy Category routes
import pharmacyCategoriesRoutes from "./routes/pharmacyCategoriesRoutes.js";

// Search routes
import searchRoutes from "./routes/search.routes.js";

// Payment routes (Stripe)
import paymentRoutes from "./routes/paymentRoutes.js";

// Prescription routes
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import revenueRoutes from "./routes/revenueRoutes.js";

dotenv.config();

const app = express()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

// Fix duplicate 2dsphere indexes after database connection
const fixDuplicateIndexes = async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState === 1) {
      const db = mongoose.connection.db;
      const collection = db.collection('pharmacies');
      const indexes = await collection.indexes();
      const sphereIndexes = indexes.filter(idx => 
        JSON.stringify(idx.key).includes('2dsphere')
      );
      
      if (sphereIndexes.length > 1) {
        console.log(`\n⚠️  Found ${sphereIndexes.length} 2dsphere indexes, cleaning up...`);
        for (let i = 1; i < sphereIndexes.length; i++) {
          try {
            await collection.dropIndex(sphereIndexes[i].name);
            console.log(`  ✓ Dropped index: ${sphereIndexes[i].name}`);
          } catch (err) {
            console.log(`  - Could not drop index ${sphereIndexes[i].name}: ${err.message}`);
          }
        }
        console.log('✓ Index cleanup complete\n');
      }
    }
  } catch (error) {
    console.log('Index fix error:', error.message);
  }
};

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Auth /User
app.use("/api/users", authRoutes);
app.use("/api/admin", adminRoutes);

//contact
app.use('/api/contact', contactRoutes);
app.use('/api/patient-testimonials', patientTestimonialRoutes);

// Lab
app.use("/api/labs", labRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/bookings", bookingRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sample-collection', sampleCollectionRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/technician', technicianAuthRoutes);

// Doctors
app.use("/api/specialties", specialtyRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/reviews", reviewRoutes);

// Prescription routes
app.use("/api/prescriptions", prescriptionRoutes);

// Pharmacy routes
app.use("/api/pharmacies", pharmacyRoutes);
app.use("/api/medicine-orders", medicineOrderRoutes);

// Registration routes
app.use("/api/doctor-registration", doctorRegistrationRoutes);
app.use('/api/pharmacy', pharmacyRegistrationRoutes);
app.use("/api/labreg", labRegistrationRoutes);

// Lab Admin routes
app.use("/api/labadmin", labadminRoutes);

// Pharmacy Category routes
app.use("/api/pharmacies/categories", pharmacyCategoriesRoutes);

// Search routes
app.use("/api/search", searchRoutes);

// Payment routes (Stripe)
app.use("/api/payments", paymentRoutes);

// Revenue routes
app.use("/api/revenue", revenueRoutes);

app.get("/", (req, res) => {
  res.send("Role-Based Auth Server is running...");
});

connectDB();
const PORT = process.env.PORT || 5000;

// Fix indexes after DB connection
setTimeout(() => {
  fixDuplicateIndexes();
}, 2000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
