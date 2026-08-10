import mongoose from "mongoose";

const specialtySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    desc: { type: String, required: true },
    doctors: { type: String, required: true },
    icon: { type: String }, // image file path
    link: { type: String },
  },
  { timestamps: true }
);

export const Specialty = mongoose.model("Specialty", specialtySchema);
