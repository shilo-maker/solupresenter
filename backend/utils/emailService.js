const { Resend } = require('resend');
const crypto = require('crypto');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Verify Your Email - SoluPresenter',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #007bff;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to SoluPresenter!</h1>
            </div>
            <div class="content">
              <h2>Verify Your Email Address</h2>
              <p>Thank you for registering with SoluPresenter. To complete your registration, please verify your email address by clicking the button below:</p>

              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 3px;">
                ${verificationUrl}
              </p>

              <p><strong>This link will expire in 24 hours.</strong></p>

              <p>If you didn't create an account with SoluPresenter, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 SoluPresenter. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Resend API error:', error);
      throw new Error('Failed to send verification email');
    }

    console.log(`✉️ Verification email sent to ${user.email}`, data);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email (for future use)
const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Password Reset Request - SoluPresenter',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #dc3545;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #dc3545;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>

              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 3px;">
                ${resetUrl}
              </p>

              <p><strong>This link will expire in 1 hour.</strong></p>

              <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 SoluPresenter. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Resend API error:', error);
      throw new Error('Failed to send password reset email');
    }

    console.log(`✉️ Password reset email sent to ${user.email}`, data);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail
};
