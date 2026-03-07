// server.js - Complete Backend API with Notification System
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

// ==================== NOTIFICATION SYSTEM ====================

app.post('/api/send-push-notification', async (req, res) => {
  try {
    const { title, message, priority = 'normal' } = req.body;
    
    // Validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }

    console.log('📢 Sending site update:', { title, message, priority });

    // 1. Save to Supabase notifications table
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert([{
        title: title,
        message: message,
        content: message,
        priority: priority,
        sent: true,
        created_at: new Date().toISOString(),
        type: 'site_update'
      }])
      .select()
      .single();

    if (dbError) {
      console.error('❌ Failed to save notification:', dbError);
      throw dbError;
    }

    // 2. Send push notifications via FCM
    let pushResult = { successCount: 0, failureCount: 0 };
    
    if (admin.apps.length) {
      try {
        // Get all FCM tokens from Supabase
        const { data: subscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('fcm_token, device_id, platform');

        if (!subError && subscriptions && subscriptions.length > 0) {
          const tokens = subscriptions.map(s => s.fcm_token).filter(Boolean);
          
          if (tokens.length > 0) {
            // Prepare FCM message
            const fcmMessage = {
              notification: {
                title: title,
                body: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
              },
              data: {
                priority: priority,
                timestamp: Date.now().toString(),
                notification_id: notification.id.toString(),
                click_action: 'OPEN_NOTIFICATION_CENTER',
                title: title,
                body: message,
                icon: '/logo.png'
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
            pushResult = await admin.messaging().sendEachForMulticast(fcmMessage);
            
            console.log(`✅ Push sent: ${pushResult.successCount} success, ${pushResult.failureCount} failed`);

            // Clean up invalid tokens
            if (pushResult.failureCount > 0) {
              const failedTokens = [];
              pushResult.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  failedTokens.push(tokens[idx]);
                }
              });

              if (failedTokens.length > 0) {
                await supabase
                  .from('push_subscriptions')
                  .delete()
                  .in('fcm_token', failedTokens);
                console.log(`🗑️ Removed ${failedTokens.length} invalid tokens`);
              }
            }
          }
        }
      } catch (fcmError) {
        console.error('❌ FCM error:', fcmError);
      }
    }

    // 3. Send email notification to admin
    try {
      await resend.emails.send({
        from: process.env.SENDER_EMAIL || "Starlink Token WiFi <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL || "billnjehia18@gmail.com",
        subject: `📢 Site Update Sent: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Site Update Sent</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">${title}</h2>
              <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p style="font-size: 16px; line-height: 1.6; color: #555;">${message}</p>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; background: #e5e7eb;"><strong>Priority:</strong></td>
                  <td style="padding: 10px; background: #f3f4f6;">
                    <span style="color: ${priority === 'urgent' ? '#ef4444' : priority === 'high' ? '#f59e0b' : '#3b82f6'};">
                      ${priority.toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; background: #e5e7eb;"><strong>Push Notifications:</strong></td>
                  <td style="padding: 10px; background: #f3f4f6;">
                    ✅ ${pushResult.successCount} delivered<br>
                    ❌ ${pushResult.failureCount} failed
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; background: #e5e7eb;"><strong>Time Sent:</strong></td>
                  <td style="padding: 10px; background: #f3f4f6;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.warn('⚠️ Admin email notification failed:', emailError.message);
    }

    res.json({
      success: true,
      notification: notification,
      push: {
        sent: pushResult.successCount,
        failed: pushResult.failureCount
      },
      message: 'Site update sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending site update:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get Notifications for Frontend
 * GET /api/notifications?since=2024-01-01&limit=50
 */
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

/**
 * Save FCM Token
 * POST /api/save-fcm-token
 * Body: { token, deviceId, platform }
 */
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

/**
 * Mark notification as read
 * POST /api/notifications/:id/read
 */
app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id } = req.body;
    
    // You can store read receipts in a separate table if needed
    // For now, just return success
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CONTACT FORM ====================

/**
 * Contact Form Submission
 * POST /api/contact
 */
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

    // Send email via Resend
    await resend.emails.send({
      from: process.env.SENDER_EMAIL || "Starlink Token WiFi <onboarding@resend.dev>",
      to: process.env.ADMIN_EMAIL || "support@starlinktokenwifi.com",
      reply_to: email,
      subject: "📩 New Contact Message - Starlink Token WiFi",
      html: `
        <div style="background:#f3f4f6;padding:40px 15px;font-family:Inter,Arial,sans-serif">
          <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:12px;
          box-shadow:0 8px 30px rgba(0,0,0,0.08);overflow:hidden">
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
                <div style="background:#f9fafb;padding:18px;border-radius:8px;
                border:1px solid #e5e7eb;line-height:1.6;font-size:14px">
                  ${message}
                </div>
              </div>
              <div style="text-align:center;margin-top:30px">
                <a href="mailto:${email}" style="display:inline-block;background:#2563eb;
                color:white;padding:12px 22px;border-radius:8px;text-decoration:none;
                font-weight:600;font-size:14px">Reply to Customer</a>
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

    // Save to Supabase messages table (optional)
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

// ==================== NOTIFICATION TRIGGERS ====================

/**
 * Notify New Message
 * POST /api/notify-new-message
 */
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

/**
 * Notify Image Upload
 * POST /api/notify-image-upload
 */
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

/**
 * Notify Bundle Update
 * POST /api/notify-bundle-update
 */
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL || 'billnjehia18@gmail.com'}`);
  console.log(`🔔 Notification system active`);
});
