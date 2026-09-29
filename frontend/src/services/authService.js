import { apiRequest } from './api.js';

export const signup = async (userData) => {
  return apiRequest('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
};

export const verifyEmail = async (email, otp) => {
  return apiRequest('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  });
};

export const resendOtp = async (email, purpose = 'email_verification') => {
  return apiRequest('/api/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email, purpose })
  });
};

export const login = async (email, password) => {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
};

export const forgotPassword = async (email) => {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
};

export const verifyResetOtp = async (email, otp) => {
  return apiRequest('/api/auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  });
};

export const resetPassword = async (resetToken, newPassword, confirmPassword) => {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ resetToken, newPassword, confirmPassword })
  });
};

export const getMe = async () => {
  return apiRequest('/api/auth/me', {
    method: 'GET'
  });
};
