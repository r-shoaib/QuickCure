import Test from "../models/test.model.js";

// CREATE TEST
export const createTest = async (req, res) => {
  try {
    const test = await Test.create(req.body);
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: "Error creating test", error });
  }
};

// GET ALL TESTS OF A LAB
export const getTestsByLab = async (req, res) => {
  try {
    const tests = await Test.find({ labId: req.params.labId });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ message: "Error fetching tests" });
  }
};

// GET SINGLE TEST
export const getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    res.json(test);
  } catch {
    res.status(404).json({ message: "Test not found" });
  }
};

// UPDATE TEST
export const updateTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(test);
  } catch {
    res.status(500).json({ message: "Error updating test" });
  }
};

// DELETE TEST
export const deleteTest = async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ message: "Test deleted successfully" });
  } catch {
    res.status(500).json({ message: "Error deleting test" });
  }
};
