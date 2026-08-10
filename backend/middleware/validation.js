import { body, validationResult } from 'express-validator';
import { PAKISTAN_DATA } from '../controllers/labReg.controller.js';

export const validateLabRegistration = [
  // Step 1: Basic Info
  body('labName')
    .trim()
    .notEmpty().withMessage('Lab name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Lab name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-&.]+$/).withMessage('Only letters, numbers, spaces, hyphens, ampersands, and periods allowed'),
  
  body('registrationNumber')
    .trim()
    .notEmpty().withMessage('Registration number is required')
    .isLength({ max: 20 }).withMessage('Registration number too long')
    .matches(/^[A-Z]{2,5}-?\d{4,8}$/).withMessage('Format: PBHL-12345 or similar'),
  
  body('labType')
    .notEmpty().withMessage('Lab type is required')
    .isIn(['diagnostic', 'hospital', 'independent', 'specialized']).withMessage('Invalid lab type'),
  
  body('establishmentYear')
    .notEmpty().withMessage('Establishment year is required')
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage(`Year must be between 1900 and ${new Date().getFullYear()}`),
  
  // Step 2: Contact Details
  body('contactPerson')
    .trim()
    .notEmpty().withMessage('Contact person is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Only letters and spaces allowed'),
  
  body('designation')
    .notEmpty().withMessage('Designation is required')
    .isIn(['Lab Director', 'Owner', 'Manager', 'Lab Technician', 'Pathologist', 'Administrator'])
    .withMessage('Invalid designation'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .isLength({ max: 100 }).withMessage('Email too long')
    .normalizeEmail(),
  
  body('mobileNumber')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^3[0-9]{9}$/).withMessage('Enter a valid Pakistani mobile number (3XXXXXXXXX)')
    .isLength({ min: 10, max: 10 }).withMessage('Mobile number must be 10 digits'),
  
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
  
  body('completeAddress')
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

export const validateEmailCheck = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];