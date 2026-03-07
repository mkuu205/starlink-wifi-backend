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

      subject: "📩 New Contact Message - Starlink Token WiFi",

      html: `
<div style="background:#f3f4f6;padding:40px 15px;font-family:Inter,Arial,sans-serif">

  <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,0.08);overflow:hidden">

    <!-- Header -->
    <div style="padding:25px;text-align:center;border-bottom:1px solid #eee">

      <img src="https://image2url.com/r2/default/images/1770561337315-920e5f5d-2254-4c03-8c95-c8eb7eac8442.jpg"
      alt="Starlink Token WiFi Logo"
      style="height:55px;margin-bottom:10px;border-radius:6px"/>

      <h2 style="margin:0;font-size:20px;color:#111">
        New Contact Message
      </h2>

      <p style="margin-top:6px;color:#6b7280;font-size:13px">
        starlinktokenwifi.com
      </p>

    </div>

    <!-- Body -->
    <div style="padding:30px">

      <div style="margin-bottom:22px">
        <div style="font-size:13px;color:#6b7280">Name</div>
        <div style="font-size:16px;font-weight:600">${name}</div>
      </div>

      <div style="margin-bottom:22px">
        <div style="font-size:13px;color:#6b7280">Email</div>
        <div style="font-size:16px;font-weight:600">${email}</div>
      </div>

      <div style="margin-bottom:22px">
        <div style="font-size:13px;color:#6b7280">Phone</div>
        <div style="font-size:16px;font-weight:600">${phone || "Not provided"}</div>
      </div>

      <div style="margin-bottom:22px">
        <div style="font-size:13px;color:#6b7280">Service</div>
        <div style="font-size:16px;font-weight:600">${service || "General Inquiry"}</div>
      </div>

      <!-- Message -->
      <div style="margin-top:20px">

        <div style="font-size:13px;color:#6b7280;margin-bottom:8px">
          Message
        </div>

        <div style="
          background:#f9fafb;
          padding:18px;
          border-radius:8px;
          border:1px solid #e5e7eb;
          line-height:1.6;
          font-size:14px;
        ">
          ${message}
        </div>

      </div>

      <!-- Reply Button -->
      <div style="text-align:center;margin-top:30px">

        <a href="mailto:${email}"
        style="
        display:inline-block;
        background:#2563eb;
        color:white;
        padding:12px 22px;
        border-radius:8px;
        text-decoration:none;
        font-weight:600;
        font-size:14px">
        Reply to Customer
        </a>

      </div>

    </div>

    <!-- Footer -->
    <div style="padding:18px;text-align:center;background:#fafafa;border-top:1px solid #eee">

      <div style="font-size:12px;color:#9ca3af">
        Message received from <strong>starlinktokenwifi.com</strong>
      </div>

      <div style="font-size:12px;color:#9ca3af;margin-top:5px">
        ${new Date().toLocaleString()}
      </div>

    </div>

  </div>

</div>
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
