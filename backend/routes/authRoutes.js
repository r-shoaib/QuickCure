
import express from "express";
import {
  signup,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  sendSignupOTP,
  verifySignupOTP,
  forgotPasswordOTP,
  verifyResetOTP,
  resetPasswordWithOTP
} from "../controllers/authController.js";

const router = express.Router();

// Regular auth routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);

// OTP routes
router.post("/send-otp", sendSignupOTP);
router.post("/verify-otp", verifySignupOTP);
router.post("/forgot-password-otp", forgotPasswordOTP);
router.post("/verify-reset-otp", verifyResetOTP);
router.post("/reset-password-with-otp", resetPasswordWithOTP);

export default router;