// //utils/sendMail.js
// import nodemailer from "nodemailer";
// import dotenv from "dotenv";
// dotenv.config();
// export const sendMail = async (to, subject, html) => {
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS
//     }
//   });

//   await transporter.sendMail({
//     from: process.env.EMAIL_USERMAIL_USER,
//     to,
//     subject,
//     html
//   });
// };

// // utils/sendMail.js
// // import nodemailer from "nodemailer";
// // import dotenv from "dotenv";
// // dotenv.config();

// // export const sendMail = async (to, subject, html) => {
// //   const transporter = nodemailer.createTransport({
// //     service: "gmail",
// //     auth: {
// //       user: process.env.EMAIL_USER,
// //       pass: process.env.EMAIL_PASS
// //     }
// //   });

// //   await transporter.sendMail({
// //     from: process.env.EMAIL_USER,
// //     to,
// //     subject,
// //     html
// //   });
// // };

// // // Specific function for sending password reset emails
// // export const sendResetPasswordEmail = async (to, resetToken) => {
// //   const resetLink = `${process.env.CLIENT_URL}/reset/${resetToken}`;
  
// //   const html = `
// //     <!DOCTYPE html>
// //     <html>
// //     <head>
// //         <meta charset="utf-8">
// //         <meta name="viewport" content="width=device-width, initial-scale=1.0">
// //         <title>Reset Your Password - QuickCure</title>
// //         <style>
// //             body {
// //                 font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
// //                 line-height: 1.6;
// //                 color: #333;
// //                 margin: 0;
// //                 padding: 0;
// //                 background-color: #f4f4f4;
// //             }
// //             .container {
// //                 max-width: 600px;
// //                 margin: 0 auto;
// //                 padding: 20px;
// //                 background-color: #ffffff;
// //                 border-radius: 10px;
// //                 box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
// //             }
// //             .header {
// //                 text-align: center;
// //                 padding: 20px 0;
// //                 background: linear-gradient(135deg, #2c6774 0%, #1e4e56 100%);
// //                 border-radius: 10px 10px 0 0;
// //                 margin: -20px -20px 30px -20px;
// //             }
// //             .logo {
// //                 color: white;
// //                 font-size: 28px;
// //                 font-weight: bold;
// //                 text-decoration: none;
// //             }
// //             .content {
// //                 padding: 0 20px;
// //             }
// //             .reset-btn {
// //                 display: inline-block;
// //                 background: linear-gradient(135deg, #2c6774 0%, #1e4e56 100%);
// //                 color: white !important;
// //                 text-decoration: none;
// //                 padding: 14px 32px;
// //                 border-radius: 8px;
// //                 font-weight: bold;
// //                 font-size: 16px;
// //                 margin: 20px 0;
// //                 text-align: center;
// //                 box-shadow: 0 4px 15px rgba(44, 103, 116, 0.3);
// //                 transition: all 0.3s ease;
// //             }
// //             .reset-btn:hover {
// //                 transform: translateY(-2px);
// //                 box-shadow: 0 6px 20px rgba(44, 103, 116, 0.4);
// //             }
// //             .footer {
// //                 text-align: center;
// //                 margin-top: 40px;
// //                 padding-top: 20px;
// //                 border-top: 1px solid #eaeaea;
// //                 color: #666;
// //                 font-size: 14px;
// //             }
// //             .token-box {
// //                 background-color: #f8f9fa;
// //                 padding: 15px;
// //                 border-radius: 5px;
// //                 border-left: 4px solid #2c6774;
// //                 margin: 20px 0;
// //                 font-family: monospace;
// //                 word-break: break-all;
// //             }
// //             .expiry-note {
// //                 background-color: #fff3cd;
// //                 border: 1px solid #ffeaa7;
// //                 border-radius: 5px;
// //                 padding: 10px;
// //                 margin: 20px 0;
// //                 color: #856404;
// //             }
// //             .security-note {
// //                 background-color: #d1ecf1;
// //                 border: 1px solid #bee5eb;
// //                 border-radius: 5px;
// //                 padding: 10px;
// //                 margin: 20px 0;
// //                 color: #0c5460;
// //             }
// //             .steps {
// //                 margin: 25px 0;
// //             }
// //             .step {
// //                 display: flex;
// //                 align-items: flex-start;
// //                 margin-bottom: 15px;
// //             }
// //             .step-number {
// //                 background-color: #2c6774;
// //                 color: white;
// //                 width: 24px;
// //                 height: 24px;
// //                 border-radius: 50%;
// //                 display: flex;
// //                 align-items: center;
// //                 justify-content: center;
// //                 margin-right: 15px;
// //                 flex-shrink: 0;
// //             }
// //             .contact-info {
// //                 background-color: #f8f9fa;
// //                 padding: 15px;
// //                 border-radius: 8px;
// //                 margin: 20px 0;
// //             }
// //             @media (max-width: 600px) {
// //                 .container {
// //                     padding: 15px;
// //                 }
// //                 .reset-btn {
// //                     display: block;
// //                     width: 100%;
// //                     box-sizing: border-box;
// //                 }
// //             }
// //         </style>
// //     </head>
// //     <body>
// //         <div class="container">
// //             <div class="header">
// //                 <div class="logo">QuickCure</div>
// //             </div>
            
// //             <div class="content">
// //                 <h2>Reset Your Password</h2>
// //                 <p>Hello,</p>
// //                 <p>We received a request to reset your password for your QuickCure account. If you made this request, please click the button below to set a new password:</p>
                
// //                 <div style="text-align: center;">
// //                     <a href="${resetLink}" class="reset-btn" target="_blank">
// //                         Reset Password
// //                     </a>
// //                 </div>
                
// //                 <p>Or copy and paste this link into your browser:</p>
// //                 <div class="token-box">
// //                     ${resetLink}
// //                 </div>
                
// //                 <div class="expiry-note">
// //                     <strong>⚠️ Important:</strong> This password reset link will expire in <strong>10 minutes</strong> for security reasons.
// //                 </div>
                
// //                 <div class="security-note">
// //                     <strong>🔒 Security Tip:</strong> If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account security.
// //                 </div>
                
// //                 <div class="steps">
// //                     <h3>Steps to Reset Your Password:</h3>
// //                     <div class="step">
// //                         <div class="step-number">1</div>
// //                         <div>Click the "Reset Password" button above</div>
// //                     </div>
// //                     <div class="step">
// //                         <div class="step-number">2</div>
// //                         <div>Enter your new password (must be at least 8 characters with uppercase, lowercase, numbers, and special characters)</div>
// //                     </div>
// //                     <div class="step">
// //                         <div class="step-number">3</div>
// //                         <div>Confirm your new password</div>
// //                     </div>
// //                     <div class="step">
// //                         <div class="step-number">4</div>
// //                         <div>Click "Reset Password" to complete the process</div>
// //                     </div>
// //                 </div>
                
// //                 <div class="contact-info">
// //                     <h4>Need Help?</h4>
// //                     <p>If you're having trouble resetting your password or didn't request this change, please contact our support team:</p>
// //                     <p>📧 Email: support@quickcure.com</p>
// //                     <p>📞 Phone: +1 (555) 123-4567</p>
// //                     <p>🕒 Hours: Monday-Friday, 9 AM - 6 PM EST</p>
// //                 </div>
                
// //                 <p>Thank you,<br>The QuickCure Team</p>
// //             </div>
            
// //             <div class="footer">
// //                 <p>&copy; ${new Date().getFullYear()} QuickCure. All rights reserved.</p>
// //                 <p>This is an automated message, please do not reply to this email.</p>
// //                 <p>
// //                     <a href="${process.env.CLIENT_URL}/privacy" style="color: #2c6774;">Privacy Policy</a> | 
// //                     <a href="${process.env.CLIENT_URL}/terms" style="color: #2c6774;">Terms of Service</a>
// //                 </p>
// //             </div>
// //         </div>
// //     </body>
// //     </html>
// //   `;
  
// //   const subject = "Reset Your QuickCure Password";
  
// //   await sendMail(to, subject, html);
// // };

// // // Alternative simple version
// // export const sendSimpleResetEmail = async (to, resetToken) => {
// //   const resetLink = `${process.env.CLIENT_URL}/reset/${resetToken}`;
  
// //   const html = `
// //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
// //       <h2 style="color: #2c6774;">Password Reset Request</h2>
// //       <p>You requested to reset your password for QuickCure.</p>
// //       <p>Click the link below to reset your password:</p>
// //       <p>
// //         <a href="${resetLink}" style="
// //           background-color: #2c6774;
// //           color: white;
// //           padding: 12px 24px;
// //           text-decoration: none;
// //           border-radius: 5px;
// //           display: inline-block;
// //           margin: 10px 0;
// //         ">
// //           Reset Password
// //         </a>
// //       </p>
// //       <p>Or copy this link: <br>${resetLink}</p>
// //       <p><strong>This link expires in 10 minutes.</strong></p>
// //       <p>If you didn't request this, please ignore this email.</p>
// //       <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
// //       <p style="color: #666; font-size: 12px;">
// //         QuickCure Team<br>
// //         This is an automated message.
// //       </p>
// //     </div>
// //   `;
  
// //   const subject = "QuickCure - Password Reset";
  
// //   await sendMail(to, subject, html);
// // };


import nodemailer from 'nodemailer';

export const sendMail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c6774;">QuickCure</h2>
          ${html}
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};