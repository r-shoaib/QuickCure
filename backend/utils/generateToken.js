// import jwt from "jsonwebtoken";

// export const generateToken = (id, remember = false) => {
//   return jwt.sign(
//     { id },
//     process.env.JWT_SECRET,
//     { expiresIn: remember ? "30d" : "1d" }
//   );
// };

import jwt from 'jsonwebtoken';

export const generateToken = (userId, remember = false) => {
  const expiresIn = remember ? '30d' : '7d';
  
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};