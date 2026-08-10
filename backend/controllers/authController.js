import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/user.model.js";
import { generateToken } from "../utils/generateToken.js";
import { sendMail } from "../utils/sendMail.js";
import { validateEmail } from "../validators/emailValidation.js";
import mongoose from "mongoose";

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP for Signup - FIXED
export const sendSignupOTP = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('=== SEND OTP START ===');
    console.log('Email:', email);

    // Check if user already exists and is verified
    const existingUser = await User.findOne({ email, isVerified: true });
    if (existingUser) {
      console.log('User already exists and is verified');
      return res.status(400).json({ msg: "Email already registered" });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Generated OTP:', otp);
    console.log('Expires at:', expiresAt);

    // Check if there's an unverified user with this email
    let user = await User.findOne({ email, isVerified: false });
    
    if (!user) {
      console.log('Creating new unverified user');
      // Create a new unverified user with verified: false in OTP
      user = new User({
        email,
        name: "temp_" + Date.now(),
        password: "temp_" + crypto.randomBytes(8).toString('hex'),
        isVerified: false,
        otp: { 
          code: otp, 
          expiresAt, 
          type: 'signup',
          verified: false  // IMPORTANT: Add this field
        }
      });
    } else {
      console.log('Updating existing unverified user');
      // Update existing unverified user's OTP with verified: false
      user.otp = { 
        code: otp, 
        expiresAt, 
        type: 'signup',
        verified: false  // IMPORTANT: Add this field
      };
    }
    
    await user.save();
    console.log('User saved with ID:', user._id);
    console.log('OTP saved with verified flag:', user.otp.verified);

    // Send email
    await sendMail(
      email,
      "OTP for Signup - QuickCure",
      `Your OTP for signup is: <strong>${otp}</strong>. It is valid for  90 seconds.`
    );

    console.log('=== SEND OTP END - SUCCESS ===');
    res.json({ msg: "OTP sent successfully" });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Verify OTP for Signup - FIXED with better logging
export const verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('=== VERIFY OTP START ===');
    console.log('Email:', email);
    console.log('OTP received:', otp);

    const user = await User.findOne({ email, isVerified: false });
    
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('No unverified user found for email:', email);
      return res.status(400).json({ msg: "No signup request found for this email" });
    }

    console.log('User ID:', user._id);
    console.log('Stored OTP object:', JSON.stringify(user.otp));
    
    if (!user.otp) {
      console.log('No OTP found in user document');
      return res.status(400).json({ msg: "No OTP found. Please request a new OTP" });
    }

    console.log('Stored OTP code:', user.otp.code);
    console.log('OTP expires at:', user.otp.expiresAt);
    console.log('Current time:', new Date());
    console.log('OTP type:', user.otp.type);
    console.log('OTP verified flag before:', user.otp.verified);

    if (user.otp.code !== otp) {
      console.log('OTP mismatch - Expected:', user.otp.code, 'Received:', otp);
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.otp.expiresAt < new Date()) {
      console.log('OTP expired at:', user.otp.expiresAt);
      // Clear expired OTP
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ msg: "OTP expired. Please request a new OTP" });
    }

    if (user.otp.type !== 'signup') {
      console.log('Invalid OTP type - Expected: signup, Got:', user.otp.type);
      return res.status(400).json({ msg: "Invalid OTP type" });
    }

    // Mark OTP as verified
    user.otp.verified = true;
    await user.save();
    
    console.log('OTP verified flag after save:', user.otp.verified);
    
    // Verify it was saved correctly by fetching again
    const verifyUser = await User.findById(user._id);
    console.log('Verified flag from DB after save:', verifyUser.otp?.verified);
    
    console.log('=== VERIFY OTP END - SUCCESS ===');

    res.json({ msg: "OTP verified successfully", verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Forgot Password - Send OTP - FIXED
export const forgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('=== FORGOT PASSWORD OTP START ===');
    console.log('Email:', email);

    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json({ msg: "Email not found" });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Generated OTP:', otp);
    console.log('Expires at:', expiresAt);

    user.otp = { 
      code: otp, 
      expiresAt, 
      type: 'reset',
      verified: false 
    };
    await user.save();

    console.log('OTP saved for user:', user._id);

    // Send email
    await sendMail(
      email,
      "OTP for Password Reset - QuickCure",
      `Your OTP for password reset is: <strong>${otp}</strong>. It is valid for 90 seconds.`
    );

    console.log('=== FORGOT PASSWORD OTP END - SUCCESS ===');
    res.json({ msg: "OTP sent for password reset" });
  } catch (err) {
    console.error('Forgot password OTP error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Verify Reset OTP - FIXED with logging
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('=== VERIFY RESET OTP START ===');
    console.log('Email:', email);
    console.log('OTP received:', otp);

    const user = await User.findOne({ email, isVerified: true });
    
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json({ msg: "User not found" });
    }

    if (!user.otp) {
      console.log('No OTP found for user');
      return res.status(400).json({ msg: "No OTP found. Please request a new OTP" });
    }

    console.log('Stored OTP:', user.otp.code);
    console.log('OTP expires:', user.otp.expiresAt);
    console.log('OTP type:', user.otp.type);

    if (user.otp.code !== otp) {
      console.log('OTP mismatch');
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.otp.expiresAt < new Date()) {
      console.log('OTP expired');
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ msg: "OTP expired. Please request a new OTP" });
    }

    if (user.otp.type !== 'reset') {
      console.log('Invalid OTP type:', user.otp.type);
      return res.status(400).json({ msg: "Invalid OTP type" });
    }

    // Mark OTP as verified
    user.otp.verified = true;
    await user.save();

    console.log('OTP verified successfully');
    console.log('=== VERIFY RESET OTP END - SUCCESS ===');

    res.json({ msg: "OTP verified successfully" });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Reset Password with OTP - FIXED
export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    console.log('=== RESET PASSWORD WITH OTP START ===');
    console.log('Email:', email);

    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ msg: "User not found" });
    }

    console.log('User found:', user._id);
    console.log('Stored OTP:', user.otp);

    // Verify OTP
    if (!user.otp) {
      console.log('No OTP found');
      return res.status(400).json({ msg: "No OTP found. Please request a new OTP" });
    }

    if (user.otp.code !== otp) {
      console.log('OTP mismatch');
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.otp.expiresAt < new Date()) {
      console.log('OTP expired');
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ msg: "OTP expired. Please request a new OTP" });
    }

    if (!user.otp.verified) {
      console.log('OTP not verified');
      return res.status(400).json({ msg: "Please verify OTP first" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.otp = undefined; // Clear OTP after use
    await user.save();

    console.log('Password reset successfully');
    console.log('=== RESET PASSWORD WITH OTP END - SUCCESS ===');

    res.json({ msg: "Password reset successfully" });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Signup - FIXED with logging
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    console.log('=== SIGNUP START ===');
    console.log('Email:', email);
    console.log('Name:', name);

    // Email validation
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ msg: emailCheck.msg });
    }

    // Check if user already exists and is verified
    let existingUser = await User.findOne({ email, isVerified: true });
    if (existingUser) {
      console.log('User already exists and is verified');
      return res.status(400).json({
        msg: "User already exists, please login"
      });
    }

    // Find the unverified user with OTP
    const unverifiedUser = await User.findOne({ email, isVerified: false });
    
    console.log('Unverified user found:', unverifiedUser ? 'Yes' : 'No');
    
    if (!unverifiedUser) {
      console.log('No unverified user found');
      return res.status(400).json({ 
        msg: "Please request OTP first" 
      });
    }

    console.log('Unverified user ID:', unverifiedUser._id);
    console.log('OTP data:', JSON.stringify(unverifiedUser.otp));
    
    if (!unverifiedUser.otp) {
      console.log('No OTP found in user document');
      return res.status(400).json({ 
        msg: "No OTP found. Please request a new OTP" 
      });
    }

    console.log('OTP verified flag:', unverifiedUser.otp.verified);
    console.log('OTP expires at:', unverifiedUser.otp.expiresAt);
    console.log('Current time:', new Date());

    // Check if OTP was verified
    if (!unverifiedUser.otp.verified) {
      console.log('OTP not verified');
      return res.status(400).json({ 
        msg: "Please verify OTP first" 
      });
    }

    // Check if OTP is still valid (not expired)
    if (unverifiedUser.otp.expiresAt < new Date()) {
      console.log('OTP expired');
      // Delete the expired unverified user
      await User.deleteOne({ _id: unverifiedUser._id });
      return res.status(400).json({ 
        msg: "OTP expired. Please request a new OTP" 
      });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);
    
    // Update the unverified user to verified
    unverifiedUser.name = name;
    unverifiedUser.password = hash;
    unverifiedUser.role = role || "user";
    unverifiedUser.isVerified = true;
    unverifiedUser.otp = undefined; // Clear OTP after successful signup
    
    await unverifiedUser.save();
    
    console.log('User successfully created with ID:', unverifiedUser._id);
    console.log('=== SIGNUP END - SUCCESS ===');

    res.json({
      msg: "Registered successfully",
      token: generateToken(unverifiedUser._id),
      user: {
        id: unverifiedUser._id,
        name: unverifiedUser.name,
        email: unverifiedUser.email,
        role: unverifiedUser.role
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ msg: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    console.log('=== LOGIN START ===');
    console.log('Email:', email);

    // Email format validation
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ msg: emailCheck.msg });
    }

    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      console.log('User not found');
      return res.status(400).json({
        msg: "Email not exists, please signup"
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Password incorrect');
      return res.status(400).json({ msg: "Incorrect password" });
    }

    // Generate token with remember me option
    const token = generateToken(user._id, remember);

    console.log('Login successful for user:', user._id);
    console.log('=== LOGIN END - SUCCESS ===');

    res.json({
      msg: "Logged in successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        doctorId: user.doctorId || undefined,
        labId: user.labId || undefined,
        pharmacyId: user.pharmacyId || undefined
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('=== FORGOT PASSWORD START ===');
    console.log('Email:', email);

    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ msg: "Email not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 10;
    await user.save();

    const link = `${process.env.CLIENT_URL}/reset/${token}`;
    await sendMail(
      email, 
      "Reset Password - QuickCure", 
      `Click <a href="${link}">here</a> to reset your password. This link is valid for 10 minutes.`
    );

    console.log('Reset email sent to:', email);
    console.log('=== FORGOT PASSWORD END - SUCCESS ===');

    res.json({ msg: "Reset email sent" });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    console.log('=== RESET PASSWORD START ===');
    console.log('Token:', token);

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
      isVerified: true
    });

    if (!user) {
      console.log('Invalid or expired token');
      return res.status(400).json({ msg: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log('Password reset successful for user:', user._id);
    console.log('=== RESET PASSWORD END - SUCCESS ===');

    res.json({ msg: "Password reset success" });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: err.message });
  }
};

/* ================= GOOGLE LOGIN ================= */
export const googleLogin = async (req, res) => {
  try {
    const { email, name, googleId, role } = req.body;

    console.log('=== GOOGLE LOGIN START ===');
    console.log('Email:', email);

    if (!email || !googleId) {
      return res.status(400).json({ msg: "Google data missing" });
    }

    let user = await User.findOne({ email });

    // If user is coming first time
    if (!user) {
      console.log('Creating new user from Google login');
      user = await User.create({
        name,
        email,
        googleId,
        role: role || "user",
        isVerified: true
      });
    }

    // If email exists but from normal signup
    if (user && !user.googleId) {
      console.log('Updating existing user with Google ID');
      user.googleId = googleId;
      await user.save();
    }

    console.log('Google login successful for user:', user._id);
    console.log('=== GOOGLE LOGIN END - SUCCESS ===');

    res.json({
      msg: "Google login success",
      token: generateToken(user._id, true),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Cleanup expired unverified users (optional - can be run as a cron job)
export const cleanupExpiredUsers = async () => {
  try {
    const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours old
    const result = await User.deleteMany({
      isVerified: false,
      createdAt: { $lt: expiryTime }
    });
    console.log(`Cleaned up ${result.deletedCount} expired unverified users`);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
};