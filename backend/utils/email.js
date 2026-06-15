const nodemailer = require('nodemailer');
const dns = require('dns');

let emailServiceReady = false;
let emailTransporter = null;

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (EMAIL_USER && EMAIL_PASS) {
    dns.resolve4('smtp.gmail.com', (err, addresses) => {
        if (!err && addresses.length > 0) {
            emailTransporter = nodemailer.createTransport({
                host: addresses[0],
                port: 587,
                secure: false,
                auth: { user: EMAIL_USER, pass: EMAIL_PASS },
                tls: { servername: 'smtp.gmail.com' }
            });
            emailTransporter.verify()
                .then(() => {
                    emailServiceReady = true;
                    console.log('✅ Email service configured (Nodemailer on IPv4 + Gmail SMTP)');
                })
                .catch((err) => {
                    console.error('❌ Email service failed to connect:', err.message);
                });
        } else {
            console.error('❌ Failed to resolve smtp.gmail.com to an IPv4 address', err);
        }
    });
} else {
    console.warn('⚠️ EMAIL_USER and EMAIL_PASS not set - reset emails will be logged to console only');
}

async function sendResetEmail(email, resetUrl) {
    if (!emailTransporter || !emailServiceReady) {
        return { success: false, message: 'Reset link logged to console' };
    }
    try {
        await emailTransporter.sendMail({
            from: `"mcqlala" <${EMAIL_USER}>`,
            to: email,
            subject: 'mcqlala - Reset Your Password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #3B82F6;">Reset Your mcqlala Password</h2>
                    <p>Click the button below to reset your password (expires in 1 hour):</p>
                    <a href="${resetUrl}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset Password</a>
                    <p style="color: #666; font-size: 14px;">Or copy this link:</p>
                    <p style="color: #3B82F6; word-break: break-all;">${resetUrl}</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
                </div>
            `
        });
        return { success: true };
    } catch (err) {
        console.error('[EMAIL ERROR]', err.message);
        return { success: false, message: err.message };
    }
}

module.exports = { sendResetEmail, isEmailReady: () => emailServiceReady };
