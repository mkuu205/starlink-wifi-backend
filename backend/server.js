// server.js - Production-ready Node.js backend for Starlink WiFi with Supabase
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://jgaeldguwezbgglwaivz.supabase.co',
    process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnYWVsZGd1d2V6YmdnbHdhaXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Nzg1NTAsImV4cCI6MjA4NjE1NDU1MH0.pAkRxRs1gvmrJJR_CNietYes6ju6qOMP8Etnpr3TtyQ'
);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://starlinktokenwifi.com'], // Add your domain
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Test Supabase connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('messages').select('count', { count: 'exact', head: true });
        if (error) throw error;
        console.log('✅ Connected to Supabase');
        return true;
    } catch (error) {
        console.error('❌ Supabase connection error:', error.message);
        return false;
    }
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER || 'support@starlinktokenwifi.com',
        pass: process.env.EMAIL_PASS // You'll set this in Render environment variables
    }
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email transporter configuration error:', error);
    } else {
        console.log('✅ Email transporter is ready to send messages');
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
                            <p><a href="${process.env.FRONTEND_URL || 'https://starlinktokenwifi.com'}/admin.html" class="button">
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
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('count', { count: 'exact', head: true });
            
        const { data: gallery, error: galError } = await supabase
            .from('gallery')
            .select('count', { count: 'exact', head: true });
            
        const dbStatus = (!msgError && !galError) ? 'connected' : 'disconnected';
        
        res.json({ 
            success: true, 
            message: 'Starlink WiFi Backend is running',
            database: dbStatus,
            email: transporter ? 'configured' : 'not configured',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: error.message
        });
    }
});

// Image upload endpoint - saves to Supabase AND sends notification
app.post('/api/upload-image', async (req, res) => {
    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ 
                success: false, 
                message: 'Image data is required' 
            });
        }

        // Save to Supabase
        const { data, error } = await supabase
            .from('gallery')
            .insert([{
                title: imageData.title || '',
                description: imageData.description || '',
                url: imageData.url,
                filename: imageData.filename,
                category: imageData.category || 'general',
                size: imageData.size,
                type: imageData.type,
                visible: true,
                uploaded_by: 'admin',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        
        // Send email notification
        const emailContent = `
            <h2>New Image Added to Gallery</h2>
            <div class="highlight">
                <p><strong>Title:</strong> ${imageData.title || 'Untitled'}</p>
                <p><strong>Description:</strong> ${imageData.description || 'No description'}</p>
                <p><strong>Category:</strong> ${imageData.category || 'general'}</p>
                <p><strong>File:</strong> ${imageData.filename || 'Unknown'}</p>
                <p><strong>Size:</strong> ${(imageData.size ? (imageData.size / 1024 / 1024).toFixed(2) : '0')} MB</p>
            </div>
            <p><small>Uploaded at: ${new Date().toLocaleString()}</small></p>
        `;

        const mailOptions = {
            from: '"Starlink Token WiFi" <support@starlinktokenwifi.com>',
            to: 'billnjehia18@gmail.com',
            subject: '🖼️ New Image Uploaded to Gallery - Admin Notification',
            html: generateEmailTemplate(emailContent, 'admin')
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Image saved to Supabase and notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Image uploaded successfully',
            data: data,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('❌ Error uploading image:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload image',
            error: error.message 
        });
    }
});

// Get all gallery images
app.get('/api/gallery', async (req, res) => {
    try {
        const { category, limit } = req.query;
        let query = supabase
            .from('gallery')
            .select('*')
            .eq('visible', true)
            .order('created_at', { ascending: false });
        
        if (category && category !== 'all') {
            query = query.eq('category', category);
        }
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
            
        res.json({
            success: true,
            data: data,
            count: data.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching gallery:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery',
            error: error.message
        });
    }
});

// Delete gallery image
app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('gallery')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: error.message
        });
    }
});

// Contact form submission endpoint - saves to Supabase AND sends notification
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body;
        
        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and message are required'
            });
        }
        
        // Save to Supabase
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                name,
                email,
                phone: phone || '',
                service: service || '',
                message,
                read: false,
                status: 'received',
                ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
                user_agent: req.get('User-Agent'),
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        
        // Send email notification to admin
        const emailContent = `
            <h2>New Message from Website Contact Form</h2>
            <div class="highlight">
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                <p><strong>Service:</strong> ${service || 'Not specified'}</p>
            </div>
            <h3>Message:</h3>
            <blockquote style="border-left: 4px solid #ddd; padding-left: 15px; margin: 15px 0;">
                ${message}
            </blockquote>
            <p><small>Received at: ${new Date().toLocaleString()}</small></p>
        `;

        const mailOptions = {
            from: '"Starlink Token WiFi" <support@starlinktokenwifi.com>',
            to: 'billnjehia18@gmail.com',
            subject: '📬 New Contact Message Received - Admin Notification',
            html: generateEmailTemplate(emailContent, 'admin')
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Message saved to Supabase and notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Message sent successfully! We\'ll contact you soon.',
            data: data,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('❌ Error processing contact form:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send message',
            error: error.message 
        });
    }
});

// Get all messages (admin only)
app.get('/api/messages', async (req, res) => {
    try {
        const { read, status, limit } = req.query;
        let query = supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (read !== undefined) {
            query = query.eq('read', read === 'true');
        }
        
        if (status) {
            query = query.eq('status', status);
        }
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Get unread count
        const { count: unreadCount, error: countError } = await supabase
            .from('messages')
            .select('count', { count: 'exact', head: true })
            .eq('read', false);
            
        res.json({
            success: true,
            data: data,
            count: data.length,
            unreadCount: countError ? 0 : unreadCount
        });
        
    } catch (error) {
        console.error('❌ Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages',
            error: error.message
        });
    }
});

// Update message status
app.patch('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { read, status } = req.body;
        
        const updateData = {};
        if (read !== undefined) {
            updateData.read = read;
            updateData.read_at = read ? new Date().toISOString() : null;
        }
        if (status) {
            updateData.status = status;
            if (status === 'responded') {
                updateData.responded_at = new Date().toISOString();
            }
        }
        
        const { data, error } = await supabase
            .from('messages')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Message updated successfully',
            data: data
        });
        
    } catch (error) {
        console.error('❌ Error updating message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update message',
            error: error.message
        });
    }
});

// Delete message
app.delete('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message',
            error: error.message
        });
    }
});

// Get all bundles
app.get('/api/bundles', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bundles')
            .select('*')
            .eq('visible', true)
            .order('price', { ascending: true });
            
        if (error) throw error;
            
        res.json({
            success: true,
            data: data,
            count: data.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching bundles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bundles',
            error: error.message
        });
    }
});

// Update bundle
app.put('/api/bundles/:bundleId', async (req, res) => {
    try {
        const { bundleId } = req.params;
        const bundleData = req.body;
        
        // Validate bundle ID
        if (!['daily', 'weekly', 'monthly', 'business'].includes(bundleId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bundle ID'
            });
        }
        
        // Update bundle
        const { data, error } = await supabase
            .from('bundles')
            .update({ 
                ...bundleData,
                last_updated: new Date().toISOString(),
                updated_by: 'admin'
            })
            .eq('bundle_id', bundleId)
            .select()
            .single();

        if (error) throw error;
        
        // Send email notification
        const featuresList = data.features 
            ? data.features.map(feature => `<li>${feature}</li>`).join('')
            : '';

        const emailContent = `
            <h2>Bundle Information Updated</h2>
            <div class="highlight">
                <p><strong>Bundle ID:</strong> ${bundleId}</p>
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Price:</strong> KSh ${data.price}</p>
            </div>
            <h3>Features:</h3>
            <ul>${featuresList}</ul>
            <p><small>Updated at: ${new Date().toLocaleString()}</small></p>
        `;

        const mailOptions = {
            from: '"Starlink Token WiFi" <support@starlinktokenwifi.com>',
            to: 'billnjehia18@gmail.com',
            subject: '📦 Bundle Updated - Admin Notification',
            html: generateEmailTemplate(emailContent, 'admin')
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Bundle updated and notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Bundle updated successfully',
            data: data,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('❌ Error updating bundle:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update bundle',
            error: error.message 
        });
    }
});

// Get bundle by ID
app.get('/api/bundles/:bundleId', async (req, res) => {
    try {
        const { bundleId } = req.params;
        const { data, error } = await supabase
            .from('bundles')
            .select('*')
            .eq('bundle_id', bundleId)
            .eq('visible', true)
            .single();
        
        if (error) throw error;
        
        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }
        
        res.json({
            success: true,
            data: data
        });
        
    } catch (error) {
        console.error('❌ Error fetching bundle:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bundle',
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
            from: '"Starlink Token WiFi" <support@starlinktokenwifi.com>',
            to: to,
            subject: subject,
            html: generateEmailTemplate(content, template)
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Generic notification sent:', info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Notification sent successfully',
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('❌ Error sending generic notification:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send notification',
            error: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Starlink WiFi Backend is online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            contact: '/api/contact',
            gallery: '/api/gallery',
            bundles: '/api/bundles',
            messages: '/api/messages',
            notification: '/api/send-notification'
        }
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
async function startServer() {
    // Test Supabase connection before starting
    const dbConnected = await testSupabaseConnection();
    
    app.listen(PORT, () => {
        console.log('\n🚀 Starlink WiFi Backend Server');
        console.log('=================================');
        console.log(`📡 Port: ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`💾 Database: ${dbConnected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
        console.log(`📧 Email: support@starlinktokenwifi.com`);
        console.log(`👤 Admin Email: billnjehia18@gmail.com`);
        console.log('=================================\n');
    });
}

startServer();

module.exports = app;
