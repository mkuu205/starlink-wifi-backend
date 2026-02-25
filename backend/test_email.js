// Test email configuration
require('dotenv').config({ path: './.env' });
const nodemailer = require('nodemailer');

console.log('\n🔍 Testing Email Configuration\n');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
console.log('\n');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    debug: true, // Enable debug output
    logger: true // Log to console
});

console.log('📧 Verifying email transporter...\n');

transporter.verify(function(error, success) {
    if (error) {
        console.log('❌ Email verification FAILED:');
        console.log('Error:', error.message);
        console.log('\n🔧 Possible solutions:');
        console.log('1. Check if the email address is correct');
        console.log('2. Verify the app password is correct (not your regular password)');
        console.log('3. Make sure 2-factor authentication is enabled on Gmail');
        console.log('4. Generate a new app password at: https://myaccount.google.com/apppasswords');
        console.log('5. Make sure "Less secure app access" is NOT needed (app passwords work without it)');
        console.log('\n📝 Current credentials:');
        console.log('   Email:', process.env.EMAIL_USER);
        console.log('   Password length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0, 'characters');
    } else {
        console.log('✅ Email transporter is ready!');
        console.log('✅ Credentials are valid');
        console.log('\n📤 Sending test email...\n');
        
        // Send test email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: '✅ Test Email - Starlink WiFi System',
            html: `
                <h2>Email Configuration Test</h2>
                <p>This is a test email from your Starlink WiFi system.</p>
                <p><strong>Status:</strong> Email system is working correctly!</p>
                <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    If you received this email, your email notifications are working properly.
                </p>
            `
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('❌ Failed to send test email:', error.message);
            } else {
                console.log('✅ Test email sent successfully!');
                console.log('📬 Message ID:', info.messageId);
                console.log('📧 Sent to:', process.env.ADMIN_EMAIL);
            }
            process.exit(error ? 1 : 0);
        });
    }
});
