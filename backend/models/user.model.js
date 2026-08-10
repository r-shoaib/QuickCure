//models/user.model.js

import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, required: true, unique: true },

  password: { type: String },

  role: {
    type: String,
    enum: ["admin", "doctor", "lab", "pharmacy", "technician", "user"],
    default: "user"
  },

  googleId: { type: String },

  // Entity-specific IDs for role-based routing
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: "Lab" },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy" },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: "Technician" },

  otp: {
    code: String,
    expiresAt: Date,
    type: { type: String, enum: ['signup', 'reset'] },
    verified: {
      type: Boolean,
      default: false
    }
  },

  resetToken: String,
  resetTokenExpiry: Date,

  rememberToken: String,

  isVerified: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

export default mongoose.model("User", userSchema);