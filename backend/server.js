// js/nodemailer.js - Production Email Notification System
// Connected to live backend: https://starlink-wifi-backend-v862.onrender.com
// No fallback - uses real backend only

import { config } from './config.js';

class EmailNotifier {
    constructor() {
        // Backend API URL - Your live Render backend
        this.apiUrl = 'https://starlink-wifi-backend-v862.onrender.com/api';
        
        // Load email configuration from config
        const emailConfig = config.getEmailConfig();
        
        this.senderEmail = emailConfig.sender || 'support@starlinktokenwifi.com';
        this.adminEmail = emailConfig.admin || 'billnjehia18@gmail.com';
        
        console.log('📧 Email Notifier initialized with backend:', this.apiUrl);
    }
    
    // Send email notification via backend API
    async sendNotification(recipientEmail, subject, message, template = 'default') {
        try {
            console.log(`📨 Sending email to: ${recipientEmail}`, { subject, template });
            
            const response = await fetch(`${this.apiUrl}/send-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: recipientEmail,
                    subject: subject,
                    content: message,
                    template: template
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }

            if (result.success) {
                console.log('✅ Email sent successfully:', result.messageId);
                
                // Show success message to user (optional)
                this.showNotification('Email sent successfully', 'success');
                
                return { 
                    success: true, 
                    messageId: result.messageId,
                    data: result
                };
            } else {
                throw new Error(result.message || 'Failed to send email');
            }
            
        } catch (error) {
            console.error('❌ Error sending email:', error);
            
            // Show error message to user
            this.showNotification('Failed to send email: ' + error.message, 'error');
            
            // Re-throw the error so calling code knows it failed
            throw new Error(`Email delivery failed: ${error.message}`);
        }
    }
    
    // Show notification to user (you can customize this)
    showNotification(message, type = 'info') {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            // You can use your existing notification system here
            // For example, if you have a toast/alert system:
            if (window.showToast) {
                window.showToast(message, type);
            } else {
                // Fallback to console only, no UI
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        }
    }
    
    // Send admin notification via backend
    async sendAdminNotification(message, type = 'info') {
        const subject = `Starlink WiFi Admin Notification - ${type.toUpperCase()}`;
        return await this.sendNotification(this.adminEmail, subject, message, 'admin');
    }
    
    // Send new message notification to admin
    async sendNewMessageNotification(messageData) {
        try {
            const subject = '📬 New Contact Message Received';
            const message = `
                <h2>New Message from Website Contact Form</h2>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>👤 Name:</strong> ${this.escapeHtml(messageData.name)}</p>
                    <p><strong>📧 Email:</strong> ${this.escapeHtml(messageData.email)}</p>
                    <p><strong>📞 Phone:</strong> ${this.escapeHtml(messageData.phone || 'Not provided')}</p>
                    <p><strong>🛠️ Service:</strong> ${this.escapeHtml(messageData.service || 'Not specified')}</p>
                </div>
                <h3>💬 Message:</h3>
                <blockquote style="border-left: 4px solid #2563eb; padding-left: 15px; margin: 15px 0; color: #4b5563;">
                    ${this.escapeHtml(messageData.message)}
                </blockquote>
                <p><small>📅 Received at: ${new Date().toLocaleString()}</small></p>
                <p><small>🌐 From: ${this.escapeHtml(messageData.page || 'Contact Form')}</small></p>
            `;
            
            return await this.sendAdminNotification(message, 'new_message');
        } catch (error) {
            console.error('Failed to send new message notification:', error);
            throw error; // Re-throw to let caller handle
        }
    }
    
    // Send image upload notification
    async sendImageUploadNotification(imageData) {
        try {
            const subject = '🖼️ New Image Uploaded to Gallery';
            const message = `
                <h2>New Image Added to Gallery</h2>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>🖼️ Title:</strong> ${this.escapeHtml(imageData.title || 'Untitled')}</p>
                    <p><strong>📝 Description:</strong> ${this.escapeHtml(imageData.description || 'No description')}</p>
                    <p><strong>🏷️ Category:</strong> ${this.escapeHtml(imageData.category || 'general')}</p>
                    <p><strong>📁 File:</strong> ${this.escapeHtml(imageData.filename || 'Unknown')}</p>
                    <p><strong>📊 Size:</strong> ${imageData.size ? (imageData.size / 1024 / 1024).toFixed(2) : '0'} MB</p>
                    ${imageData.url ? `<p><strong>🔗 URL:</strong> <a href="${this.escapeHtml(imageData.url)}">View Image</a></p>` : ''}
                </div>
                <p><small>📅 Uploaded at: ${new Date().toLocaleString()}</small></p>
                <p><small>👤 Uploaded by: Admin</small></p>
            `;
            
            return await this.sendAdminNotification(message, 'image_upload');
        } catch (error) {
            console.error('Failed to send image upload notification:', error);
            throw error;
        }
    }
    
    // Send bundle update notification
    async sendBundleUpdateNotification(bundleData, bundleId) {
        try {
            const subject = '📦 Bundle Updated';
            
            // Format features as list
            const featuresList = bundleData.features && Array.isArray(bundleData.features) 
                ? bundleData.features.map(f => `<li>${this.escapeHtml(f)}</li>`).join('')
                : '<li>No features listed</li>';
            
            const message = `
                <h2>Bundle Information Updated</h2>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>📦 Bundle ID:</strong> ${this.escapeHtml(bundleId)}</p>
                    <p><strong>🏷️ Name:</strong> ${this.escapeHtml(bundleData.name)}</p>
                    <p><strong>💰 Price:</strong> KSh ${this.escapeHtml(bundleData.price)}</p>
                </div>
                <h3>✨ Features:</h3>
                <ul>
                    ${featuresList}
                </ul>
                <p><small>📅 Updated at: ${new Date().toLocaleString()}</small></p>
                <p><small>👤 Updated by: Admin</small></p>
            `;
            
            return await this.sendAdminNotification(message, 'bundle_update');
        } catch (error) {
            console.error('Failed to send bundle update notification:', error);
            throw error;
        }
    }
    
    // Test backend connection
    async testConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ Backend connection successful:', data);
                return { success: true, data };
            } else {
                throw new Error('Backend health check failed');
            }
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Helper: Escape HTML to prevent XSS
    escapeHtml(unsafe) {
        if (!unsafe) return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize email notifier
const emailNotifier = new EmailNotifier();

// Test connection on initialization (optional)
emailNotifier.testConnection().then(result => {
    if (result.success) {
        console.log('🚀 Email system ready with live backend');
    } else {
        console.warn('⚠️ Email system initialized but backend unreachable');
    }
});

// Export for use in other modules
export { emailNotifier };
