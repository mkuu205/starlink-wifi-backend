// server.js - Backend API for Starlink Token WiFi
// Email: support@starlinktokenwifi.com (forwards to billnjehia18@gmail.com)

const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

/* =========================
   CORS
========================= */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

/* =========================
   Environment Check
========================= */

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

/* =========================
   Supabase
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log("💾 Supabase initialized");

/* =========================
   Firebase Admin (Optional)
========================= */

if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY &&
  !admin.apps.length
) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });

    console.log("✅ Firebase Admin initialized");

  } catch (error) {
    console.warn("⚠️ Firebase Admin initialization failed:", error.message);
  }
}

/* =========================
   Email Transporter
========================= */

let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000
  });

  transporter.verify((error) => {
    if (error) {
      console.error("❌ Email transporter configuration error:", error.message);
    } else {
      console.log("✅ Email server ready");
    }
  });

} else {

  console.warn("⚠️ Email not configured. Emails will be skipped.");

}

/* =========================
   Health Check
========================= */

app.get('/api/health', (req, res) => {

  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    email: process.env.EMAIL_USER || "not configured"
  });

});

/* =========================
   Contact Form
========================= */

app.post('/api/contact', async (req, res) => {

  try {

    const { name, email, phone, service, message } = req.body;

    console.log("📨 New contact form from:", name, email);

    /* Save to Supabase */

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          name,
          email,
          phone,
          service,
          message,
          status: "received",
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error("❌ Database error:", error.message);
      throw error;
    }

    console.log("✅ Message saved to database");

    /* Send email (optional) */

    const adminEmail = process.env.ADMIN_EMAIL || "billnjehia18@gmail.com";

    if (transporter) {

      try {

        await transporter.sendMail({

          from: `"Starlink Token WiFi" <${process.env.EMAIL_USER}>`,
          to: adminEmail,
          replyTo: email,
          subject: "New Contact Form Submission - Starlink Token WiFi",

          html: `
          <div style="font-family: Arial; max-width:600px; margin:auto">

          <h2 style="color:#2563eb">New Website Message</h2>

          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
          <p><strong>Service:</strong> ${service || "Not specified"}</p>

          <h3>Message</h3>

          <p style="background:#f3f4f6;padding:15px;border-left:4px solid #2563eb">
          ${message}
          </p>

          <hr>

          <small>
          Sent from starlinktokenwifi.com<br>
          ${new Date().toLocaleString()}
          </small>

          </div>
          `
        });

        console.log("✅ Email sent to:", adminEmail);

      } catch (mailError) {

        console.error("⚠️ Email failed but message saved:", mailError.message);

      }

    }

    res.json({
      success: true,
      message: "Message received successfully"
    });

  } catch (error) {

    console.error("❌ Contact form error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to submit form"
    });

  }

});

/* =========================
   Send Push Notification
========================= */

app.post('/api/send-push-notification', async (req, res) => {

  try {

    if (!admin.apps.length) {
      throw new Error("Firebase Admin not initialized");
    }

    const { title, body, priority = "normal" } = req.body;

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("fcm_token");

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return res.json({
        success: false,
        message: "No subscribers"
      });
    }

    const tokens = subscriptions.map(s => s.fcm_token);

    const response = await admin.messaging().sendEachForMulticast({

      tokens,
      notification: { title, body },

      data: {
        priority,
        timestamp: Date.now().toString()
      }

    });

    console.log(`✅ Push sent: ${response.successCount}`);

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    });

  } catch (error) {

    console.error("❌ Push error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   Send Notification Email
========================= */

app.post('/api/send-notification', async (req, res) => {

  try {

    const { to, subject, content } = req.body;

    if (!transporter) {
      throw new Error("Email service not configured");
    }

    await transporter.sendMail({

      from: `"Starlink Token WiFi" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: content

    });

    res.json({
      success: true,
      message: "Email sent successfully"
    });

  } catch (error) {

    console.error("❌ Send notification error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   Server Start
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("=================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || "not configured"}`);
  console.log(`👤 Admin Email: ${process.env.ADMIN_EMAIL || "billnjehia18@gmail.com"}`);
  console.log("=================================");

});
