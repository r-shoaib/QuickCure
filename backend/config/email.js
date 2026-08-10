import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const emailConfig = {
  from: process.env.EMAIL_FROM || 'QuickCure <noreply@quickcure.com>',
  resetPasswordSubject: 'Reset Your QuickCure Password',
  resetPasswordTemplate: (resetLink) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Password Reset Request</h2>
      <p>You requested to reset your password for QuickCure.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" style="display: inline-block; background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 15px 0;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr style="border: 1px solid #eee;">
      <p style="color: #7f8c8d; font-size: 12px;">QuickCure Healthcare System</p>
    </div>
  `
};