// server.js - Backend API for Starlink Token WiFi
// Email: support@starlinktokenwifi.com (forwards to billnjehia18@gmail.com)

const express = require('express');
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize Firebase Admin (optional)
if (process.env.FIREBASE_PROJECT_ID && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.warn('⚠️ Firebase Admin not initialized:', error.message);
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Contact Form Submission
app.post("/api/contact", async (req, res) => {

  try {

    const { name, email, phone, service, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    console.log("📨 New contact form from:", name, email);

    await resend.emails.send({

      from: process.env.SENDER_EMAIL || "Starlink Token WiFi <onboarding@resend.dev>",

      to: process.env.ADMIN_EMAIL || "support@starlinktokenwifi.com",

      reply_to: email,

      subject: "New Contact Form Message",

      html: `
        <h2>New Website Message</h2>

        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone || "Not provided"}</p>
        <p><b>Service:</b> ${service || "Not specified"}</p>

        <p><b>Message:</b></p>
        <p>${message}</p>
      `
    });

    res.json({
      success: true,
      message: "Email sent successfully"
    });

  } catch (error) {

    console.error("❌ Email error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send email"
    });

  }

});

// Send Push Notification
app.post('/api/send-push-notification', async (req, res) => {
  try {
    const { title, body, priority = 'normal' } = req.body;
    
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }
    
    // Get FCM tokens
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('fcm_token');
    
    if (error) throw error;
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.json({ success: false, message: 'No subscribers found' });
    }
    
    const tokens = subscriptions.map(s => s.fcm_token);
    const message = {
      notification: { title, body },
      data: { priority, timestamp: Date.now().toString() },
      tokens: tokens
    };
    
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ Push sent: ${response.successCount} success, ${response.failureCount} failed`);
    
    // Remove failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) failedTokens.push(tokens[idx]);
      });
      
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('fcm_token', failedTokens);
    }
    
    res.json({ 
      success: true, 
      sent: response.successCount,
      failed: response.failureCount
    });
    
  } catch (error) {
    console.error('❌ Push notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Notify New Message (using Resend)
app.post('/api/notify-new-message', async (req, res) => {
  try {
    const { messageData, adminEmail } = req.body;
    const recipient = adminEmail || process.env.ADMIN_EMAIL || 'billnjehia18@gmail.com';
    
    await resend.emails.send({
      from: "Starlink Token WiFi <support@starlinktokenwifi.com>",
      to: recipient,
      reply_to: messageData.email,
      subject: '📬 New Contact Message Received',
      html: `
        <h2>New Message from Website</h2>
        <p><strong>Name:</strong> ${messageData.name}</p>
        <p><strong>Email:</strong> ${messageData.email}</p>
        <p><strong>Phone:</strong> ${messageData.phone || 'Not provided'}</p>
        <p><strong>Service:</strong> ${messageData.service || 'Not specified'}</p>
        <p><strong>Message:</strong></p>
        <p>${messageData.message}</p>
      `
    });
    
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Notify Image Upload (using Resend)
app.post('/api/notify-image-upload', async (req, res) => {
  try {
    const { imageData, adminEmail } = req.body;
    const recipient = adminEmail || process.env.ADMIN_EMAIL || 'billnjehia18@gmail.com';
    
    await resend.emails.send({
      from: "Starlink Token WiFi <support@starlinktokenwifi.com>",
      to: recipient,
      subject: '🖼️ New Image Uploaded to Gallery',
      html: `
        <h2>New Image Added to Gallery</h2>
        <p><strong>Title:</strong> ${imageData.title || 'Untitled'}</p>
        <p><strong>Category:</strong> ${imageData.category || 'general'}</p>
        <p><strong>Filename:</strong> ${imageData.filename || 'Unknown'}</p>
      `
    });
    
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Notify Bundle Update (using Resend)
app.post('/api/notify-bundle-update', async (req, res) => {
  try {
    const { bundleData, bundleId, adminEmail } = req.body;
    const recipient = adminEmail || process.env.ADMIN_EMAIL || 'billnjehia18@gmail.com';
    
    await resend.emails.send({
      from: "Starlink Token WiFi <support@starlinktokenwifi.com>",
      to: recipient,
      subject: '📦 Bundle Updated',
      html: `
        <h2>Bundle Information Updated</h2>
        <p><strong>Bundle ID:</strong> ${bundleId}</p>
        <p><strong>Name:</strong> ${bundleData.name}</p>
        <p><strong>Price:</strong> KSh ${bundleData.price}</p>
      `
    });
    
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL || 'billnjehia18@gmail.com'}`);
});
