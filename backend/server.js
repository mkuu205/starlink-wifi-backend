// server.js - Backend API for Starlink Token WiFi
// Email: support@starlinktokenwifi.com (forwards to billnjehia18@gmail.com)

const express = require('express');
const { Resend } = require("resend");
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize Firebase Admin
if (process.env.FIREBASE_PROJECT_ID && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.warn('⚠️ Firebase Admin not initialized:', error.message);
  }
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!supabase,
      resend: !!resend,
      firebase: admin.apps.length > 0
    }
  });
});

// ==================== PUSH NOTIFICATION ENDPOINT ====================

// Send Push Notification - EXPECTS 'message' FIELD
app.post('/api/send-push-notification', async (req, res) => {
  try {
    const { title, message, priority = 'normal' } = req.body;
    
    console.log('📨 Received push notification request:', { title, message, priority });
    
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }
    
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }
    
    // Save to notifications table in Supabase
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert([{
        title: title,
        message: message,
        content: message,
        priority: priority,
        sent: true,
        created_at: new Date().toISOString(),
        type: 'push_notification'
      }])
      .select()
      .single();
    
    if (dbError) {
      console.error('❌ Failed to save notification:', dbError);
      // Continue anyway - don't block push notifications
    }
    
    // Get FCM tokens from Supabase
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('fcm_token');
    
    if (subError) throw subError;
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.json({ 
        success: true, 
        sent: 0, 
        failed: 0,
        message: 'No subscribers found' 
      });
    }
    
    const tokens = subscriptions.map(s => s.fcm_token).filter(Boolean);
    
    if (tokens.length === 0) {
      return res.json({ 
        success: true, 
        sent: 0, 
        failed: 0,
        message: 'No valid tokens found' 
      });
    }
    
    // Prepare FCM message
    const fcmMessage = {
      notification: { 
        title: title, 
        body: message.substring(0, 100) + (message.length > 100 ? '...' : '') 
      },
      data: { 
        priority, 
        timestamp: Date.now().toString(),
        notification_id: notification?.id?.toString() || Date.now().toString()
      },
      tokens: tokens,
      webpush: {
        headers: {
          Urgency: priority === 'urgent' ? 'high' : 'normal'
        },
        notification: {
          icon: '/logo.png',
          badge: '/logo.png',
          requireInteraction: priority === 'urgent' || priority === 'high',
          vibrate: priority === 'urgent' ? [500, 200, 500] : [200, 100, 200]
        }
      }
    };
    
    // Send push notifications
    const response = await admin.messaging().sendEachForMulticast(fcmMessage);
    
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
      
      console.log(`🗑️ Removed ${failedTokens.length} invalid tokens`);
    }
    
    res.json({ 
      success: true, 
      sent: response.successCount,
      failed: response.failureCount,
      notification_id: notification?.id
    });
    
  } catch (error) {
    console.error('❌ Push notification error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ==================== CONTACT FORM ====================

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
          <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.08);overflow:hidden">
            <div style="padding:25px;text-align:center;border-bottom:1px solid #eee">
              <img src="https://image2url.com/r2/default/images/1770561337315-920e5f5d-2254-4c03-8c95-c8eb7eac8442.jpg"
              alt="Starlink Token WiFi Logo"
              style="height:55px;margin-bottom:10px;border-radius:6px"/>
              <h2 style="margin:0;font-size:20px;color:#111">New Contact Message</h2>
              <p style="margin-top:6px;color:#6b7280;font-size:13px">starlinktokenwifi.com</p>
            </div>
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
              <div style="margin-top:20px">
                <div style="font-size:13px;color:#6b7280;margin-bottom:8px">Message</div>
                <div style="background:#f9fafb;padding:18px;border-radius:8px;border:1px solid #e5e7eb;line-height:1.6;font-size:14px">
                  ${message}
                </div>
              </div>
              <div style="text-align:center;margin-top:30px">
                <a href="mailto:${email}" style="display:inline-block;background:#2563eb;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                  Reply to Customer
                </a>
              </div>
            </div>
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

    // Save to Supabase messages table
    await supabase
      .from('messages')
      .insert([{
        name: name,
        email: email,
        phone: phone,
        service: service,
        message: message,
        status: 'new',
        created_at: new Date().toISOString()
      }]);

    res.json({
      success: true,
      message: "Message sent successfully"
    });

  } catch (error) {
    console.error("❌ Email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message"
    });
  }
});

// ==================== SAVE FCM TOKEN ====================

app.post('/api/save-fcm-token', async (req, res) => {
  try {
    const { token, deviceId, platform = 'web', userAgent } = req.body;
    
    if (!token || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Token and deviceId are required"
      });
    }
    
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        device_id: deviceId,
        fcm_token: token,
        platform: platform,
        user_agent: userAgent,
        last_active: new Date().toISOString()
      }, { 
        onConflict: 'device_id',
        ignoreDuplicates: false 
      });
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Token saved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error saving token:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== GET NOTIFICATIONS ====================

app.get('/api/notifications', async (req, res) => {
  try {
    const { since, limit = 50 } = req.query;
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('sent', true)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (since) {
      query = query.gt('created_at', since);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      notifications: data || []
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL || 'billnjehia18@gmail.com'}`);
  console.log(`🔔 Push notification endpoint: /api/send-push-notification (expects title, message, priority)`);
});
