import { body, validationResult } from 'express-validator';
import { PAKISTAN_DATA } from '../controllers/pharmacyReg.controller.js';

export const validatePharmacyRegistration = [
  // Step 1: Pharmacy Details
  body('pharmacyName')
    .trim()
    .notEmpty().withMessage('Pharmacy name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Pharmacy name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-&.]+$/).withMessage('Only letters, numbers, spaces, hyphens, ampersands, and periods allowed'),
  
  body('licenseNumber')
    .trim()
    .notEmpty().withMessage('License number is required')
    .isLength({ max: 20 }).withMessage('License number too long')
    .matches(/^\d{5}-[A-Z]\/\d{2}$/).withMessage('Format: 23269-A/20 (5 digits, hyphen, letter, slash, 2 digits)'),
  
  body('pharmacyType')
    .notEmpty().withMessage('Pharmacy type is required')
    .isIn(['retail', 'hospital', 'chain', 'independent', 'compounding', 'online']).withMessage('Invalid pharmacy type'),
  
  body('licenseExpiry')
    .notEmpty().withMessage('License expiry date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom(value => {
      const expiryDate = new Date(value);
      const today = new Date();
      if (expiryDate <= today) {
        throw new Error('License expiry date must be in the future');
      }
      return true;
    }),
  
  body('yearEstablished')
    .notEmpty().withMessage('Year established is required')
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage(`Year must be between 1900 and ${new Date().getFullYear()}`),
  
  // Step 2: Contact Information
  body('ownerName')
    .trim()
    .notEmpty().withMessage('Owner name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Only letters and spaces allowed'),
  
  body('ownerCnic')
    .trim()
    .notEmpty().withMessage('Owner CNIC is required')
    .matches(/^\d{5}-\d{7}-\d{1}$/).withMessage('Invalid CNIC format (Example: 12345-1234567-1)'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .isLength({ max: 100 }).withMessage('Email too long')
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^3[0-9]{9}$/).withMessage('Enter a valid Pakistani phone number (3XXXXXXXXX)')
    .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),
  
  // Step 3: Location
  body('province')
    .notEmpty().withMessage('Province is required')
    .isIn(['punjab', 'sindh', 'kpk', 'balochistan', 'islamabad', 'gilgit', 'ajk'])
    .withMessage('Invalid province'),
  
  body('city')
    .notEmpty().withMessage('City is required')
    .custom((value, { req }) => {
      const province = req.body.province;
      if (!province) return true;
      
      const validCities = PAKISTAN_DATA?.cities?.[province] || [];
      if (!validCities.includes(value)) {
        throw new Error('Invalid city for selected province');
      }
      return true;
    }),
  
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 10, max: 200 }).withMessage('Address must be between 10 and 200 characters')
    .matches(/^[a-zA-Z0-9\s,./#-]+$/).withMessage('Please enter a valid address'),
  
  // Step 5: Terms
  body('termsAccepted')
    .notEmpty().withMessage('You must accept the terms to continue')
    .isIn(['true', true]).withMessage('You must accept the terms'),
  
  body('commissionAgreed')
    .notEmpty().withMessage('You must agree to the terms and conditions')
    .isIn(['true', true]).withMessage('You must agree to the terms'),
  
  // Validation middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];