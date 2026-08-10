import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    patientName: {
      type: String,
      required: true,
    },
    patientEmail: {
      type: String,
      required: false,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
      },
    ],
    consultationType: {
      type: String,
      enum: ["Video Consultation", "Physical Visit"],
      default: "Video Consultation",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);