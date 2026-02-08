// server.js - Production-ready Node.js backend for Starlink WiFi
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Email transporter configuration
const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter configuration error:', error);
    } else {
        console.log('Email transporter is ready to send messages');
    }
});

// Utility function to generate email templates
function generateEmailTemplate(content, templateType = 'default') {
    const templates = {
        default: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        margin: 0; 
                        padding: 0;
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 20px; 
                    }
                    .header { 
                        background: #2563eb; 
                        color: white; 
                        padding: 20px; 
                        text-align: center; 
                    }
                    .content { 
                        padding: 20px; 
                        background: #f9f9f9; 
                    }
                    .footer { 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #666; 
                        background: #f1f1f1;
                    }
                    .highlight {
                        background: #e3f2fd;
                        padding: 15px;
                        border-left: 4px solid #2196f3;
                        margin: 15px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Starlink Token WiFi</h1>
                    </div>
                    <div class="content">
                        ${content}
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Starlink Token WiFi</p>
                        <p>© 2024 Starlink Token WiFi. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        
        admin: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        margin: 0; 
                        padding: 0;
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 20px; 
                    }
                    .header { 
                        background: #dc2626; 
                        color: white; 
                        padding: 20px; 
                        text-align: center; 
                    }
                    .content { 
                        padding: 20px; 
                        background: #fef2f2; 
                        border-left: 4px solid #dc2626; 
                    }
                    .footer { 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #666; 
                        background: #f1f1f1;
                    }
                    .highlight { 
                        background: #fee2e2; 
                        padding: 15px; 
                        border-radius: 5px; 
                        margin: 15px 0; 
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 24px;
                        background: #2563eb;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>ADMIN NOTIFICATION</h1>
                        <p>Starlink Token WiFi - Admin Panel Alert</p>
                    </div>
                    <div class="content">
                        ${content}
                        <div class="highlight">
                            <p><strong>Action Required:</strong> Please log in to the admin panel to review this notification.</p>
                            <p><a href="${process.env.FRONTEND_URL || 'https://your-domain.com'}/admin.html" class="button">
                                Go to Admin Panel
                            </a></p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated administrative notification</p>
                        <p>© 2024 Starlink Token WiFi. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    return templates[templateType] || templates.default;
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Starlink WiFi Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Image upload notification endpoint
app.post('/api/notify-image-upload', async (req, res) => {
    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ 
                success: false, 
                message: 'Image data is required' 
            });
        }

        const emailContent = `
            <h2>New Image Added to Gallery</h2>
            <div class="highlight">
                <p><strong>Title:</strong> ${imageData.title || 'Untitled'}</p>
                <p><strong>Description:</strong> ${imageData.description || 'No description'}</p>
                <p><strong>Category:</strong> ${imageData.category || 'general'}</p>
                <p><strong>File:</strong> ${imageData.filename || 'Unknown'}</p>
                <p><strong>Size:</strong> ${(imageData.size ? (imageData.size / 1024 / 1024).toFixed(2) : '0')} MB</p>
            </div>
            <p><small>Uploaded at: ${new Date(imageData.timestamp || Date.now()).toLocaleString()}</small></p>
        `;

        const mailOptions = {
            from: process.env.SENDER_EMAIL || '"Starlink WiFi" <notifications@starlinkwifi.com>',
            to: process.env.ADMIN_EMAIL || 'admin@starlinkwifi.com',
            subject: 'New Image Uploaded to Gallery - Admin Notification',
            html: generateEmailTemplate(emailContent, 'admin')
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('Image upload notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Image upload notification sent successfully',
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending image upload notification:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send notification',
            error: error.message 
        });
    }
});

// New message notification endpoint
app.post('/api/notify-new-message', async (req, res) => {
    try {
        const { messageData } = req.body;
        
        if (!messageData) {
            return res.status(400).json({ 
                success: false, 
                message: 'Message data is required' 
            });
        }

        const emailContent = `
            <h2>New Message from Website Contact Form</h2>
            <div class="highlight">
                <p><strong>Name:</strong> ${messageData.name}</p>
                <p><strong>Email:</strong> ${messageData.email}</p>
                <p><strong>Phone:</strong> ${messageData.phone || 'Not provided'}</p>
                <p><strong>Service:</strong> ${messageData.service || 'Not specified'}</p>
            </div>
            <h3>Message:</h3>
            <blockquote style="border-left: 4px solid #ddd; padding-left: 15px; margin: 15px 0;">
                ${messageData.message}
            </blockquote>
            <p><small>Received at: ${new Date(messageData.timestamp || Date.now()).toLocaleString()}</small></p>
        `;

        const mailOptions = {
            from: process.env.SENDER_EMAIL || '"Starlink WiFi" <notifications@starlinkwifi.com>',
            to: process.env.ADMIN_EMAIL || 'admin@starlinkwifi.com',
            subject: 'New Contact Message Received - Admin Notification',
            html: generateEmailTemplate(emailContent, 'admin')
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('New message notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'New message notification sent successfully',
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending new message notification:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send notification',
            error: error.message 
        });
    }
});

// Bundle update notification endpoint
app.post('/api/notify-bundle-update', async (req, res) => {
    try {
        const { bundleData, bundleId } = req.body;
        
        if (!bundleData || !bundleId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bundle data and ID are required' 
            });
        }

        const featuresList = bundleData.features 
            ? bundleData.features.map(feature => `<li>${feature}</li>`).join('')
            : '';

        const emailContent = `
            <h2>Bundle Information Updated</h2>
            <div class="highlight">
                <p><strong>Bundle ID:</strong> ${bundleId}</p>
                <p><strong>Name:</strong> ${bundleData.name}</p>
                <p><strong>Price:</strong> KSh ${bundleData.price}</p>
            </div>
            <h3>Features:</h3>
            <ul>${featuresList}</ul>
            <p><small>Updated at: ${new Date(bundleData.updated || Date.now()).toLocaleString()}</small></p>
        `;

        const mailOptions = {
            from: process.env.SENDER_EMAIL || '"Starlink WiFi" <notifications@starlinkwifi.com>',
            to: process.env.ADMIN_EMAIL || 'admin@starlinkwifi.com',
            subject: 'Bundle Updated - Admin Notification',
            html: generateEmailTemplate(emailContent, 'admin')
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('Bundle update notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Bundle update notification sent successfully',
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending bundle update notification:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send notification',
            error: error.message 
        });
    }
});

// Generic notification endpoint
app.post('/api/send-notification', async (req, res) => {
    try {
        const { to, subject, content, template = 'default' } = req.body;
        
        if (!to || !subject || !content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Recipient, subject, and content are required' 
            });
        }

        const mailOptions = {
            from: process.env.SENDER_EMAIL || '"Starlink WiFi" <notifications@starlinkwifi.com>',
            to: to,
            subject: subject,
            html: generateEmailTemplate(content, template)
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('Generic notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Notification sent successfully',
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending generic notification:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send notification',
            error: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Starlink WiFi Backend Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email notifications: ${process.env.EMAIL_USER ? 'ENABLED' : 'DISABLED'}`);
});

module.exports = app;
