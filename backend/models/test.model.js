import mongoose from "mongoose";

const testSchema = new mongoose.Schema({
  labId: { type: mongoose.Schema.Types.ObjectId, ref: "Lab", required: true },
  name: { type: String, required: true },
  description: String,
  price: Number,
  // discount: Number,
});

export default mongoose.model("Test", testSchema);
