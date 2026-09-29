import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  } else {
    // Development fallback transporter - prints to console
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n================== [NUDGE CHAT EMAIL SERVICE] ==================');
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text || mailOptions.html}`);
        console.log('=================================================================\n');
        return { messageId: 'mock-dev-id-' + Date.now() };
      }
    };
  }

  return transporter;
};

export const sendOtpEmail = async (email, otp, purpose) => {
  const currentTransporter = getTransporter();

  const isVerification = purpose === 'email_verification';
  const subject = isVerification 
    ? 'Verify your Nudge Chat Account' 
    : 'Reset your Nudge Chat Password';

  const title = isVerification ? 'Welcome to Nudge Chat!' : 'Password Reset Request';
  const description = isVerification
    ? 'Please use the 6-digit verification code below to verify your email address. This code expires in 10 minutes.'
    : 'You requested a password reset for your Nudge Chat account. Use the 6-digit code below to set a new password. This code expires in 10 minutes.';

  const html = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Nudge Chat</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Real-Time Messaging Platform</p>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">${title}</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">${description}</p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #4338ca; background: #eef2ff; padding: 14px 28px; border-radius: 8px; border: 1px dashed #6366f1;">
          ${otp}
        </span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">If you did not request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">&copy; ${new Date().getFullYear()} Nudge Chat. Built with security and real-time reliability.</p>
    </div>
  `;

  const text = `${title}\n\n${description}\n\nYour 6-digit Code: ${otp}\n\nThis code will expire in 10 minutes.\n`;

  await currentTransporter.sendMail({
    from: process.env.EMAIL_FROM || '"Nudge Chat" <no-reply@nudgechat.com>',
    to: email,
    subject,
    text,
    html
  });
};
