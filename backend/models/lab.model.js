// models/lab.model.js
import mongoose from "mongoose";

const labSchema = new mongoose.Schema({
  name: { type: String },
  logo: String,
  branches: String,
  discount: Number,
  serviceCities: [{ type: String, trim: true }],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Lab", labSchema);