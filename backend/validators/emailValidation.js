// src/utils/emailValidation.js

// 1️⃣ Basic email format regex
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 2️⃣ Allowed common email providers
export const allowedEmailDomains = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "zoho.com",
];

// 3️⃣ Common typing mistakes (sirf hint ke liye)
const gmailTypos = [
  "gamil.com",
  "gmial.com",
  "gmal.com",
  "gmail.con",
];

// 4️⃣ Domain nikaalne ka helper
export const getEmailDomain = (email) => {
  return email.split("@")[1]?.toLowerCase();
};

// 5️⃣ Main email validation function
export const validateEmail = (email) => {
  if (!email.trim()) {
    return { valid: false, message: "Email is required" };
  }

  if (!emailRegex.test(email)) {
    return { valid: false, message: "Please enter a valid email format" };
  }

  const domain = getEmailDomain(email);

  // Gmail typo suggestion
  if (gmailTypos.includes(domain)) {
    return {
      valid: false,
      message: `Did you mean ${email.replace(domain, "gmail.com")}?`,
    };
  }

  // Allow all domains (corporate bhi)
  return { valid: true };
};
