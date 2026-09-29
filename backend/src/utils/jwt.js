import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nudge_chat_super_secure_jwt_secret_key_2026';

export const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
