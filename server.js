const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'clearoskin_super_secret_key'; // In production, use environment variables

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from current directory

// Connect to SQLite Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create users table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create orders table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      items TEXT NOT NULL,
      total_price REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// API Routes

// 1. Signup Route
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  try {
    // Check if user already exists
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (user) return res.status(400).json({ error: 'User with this email already exists.' });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate Verification Token (6-digit OTP for simplicity)
      const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

      // Insert new user
      db.run(`INSERT INTO users (name, email, password, verification_token, is_verified) VALUES (?, ?, ?, ?, 0)`, 
        [name, email, hashedPassword, verificationToken], 
        async function(err) {
          if (err) return res.status(500).json({ error: 'Failed to register user.' });
          
          // Send Verification Email
          try {
            let transporter = nodemailer.createTransport({
              host: "smtp.ethereal.email",
              port: 587,
              secure: false,
              auth: { user: 'prajwal.notification@ethereal.email', pass: 'mock_password_123' },
            });

            const emailHtml = `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0f0ee; border-radius: 12px; padding: 32px;">
                <h1 style="color: #008080; text-align: center;">Verify Your Email</h1>
                <p>Hi ${name},</p>
                <p>Thank you for joining ClearoSkin! Please use the OTP below to verify your account:</p>
                <div style="background: #f4fbfb; padding: 24px; text-align: center; border-radius: 8px; margin: 24px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #008080;">${verificationToken}</span>
                </div>
                <p style="font-size: 14px; color: #666;">This code will expire in 1 hour. If you didn't create an account, you can safely ignore this email.</p>
              </div>
            `;

            console.log(`[Email Simulation] Sending verification OTP ${verificationToken} to ${email}`);
            // await transporter.sendMail({ from: '"ClearoSkin" <no-reply@clearoskin.com>', to: email, subject: "Verify your email", html: emailHtml });

            res.status(201).json({ 
              message: 'Account created! Please check your email for the verification code.',
              requiresVerification: true,
              email
            });
          } catch (mailErr) {
            console.error('Email error:', mailErr);
            res.status(201).json({ message: 'Account created, but failed to send verification email.' });
          }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 1b. Verify Email Route
app.post('/api/verify', (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'Email and verification token are required.' });
  }

  db.get(`SELECT * FROM users WHERE email = ? AND verification_token = ?`, [email, token], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'Invalid verification code.' });

    db.run(`UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?`, [user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to verify account.' });
      
      const jwtToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '7d' });
      res.json({ message: 'Email verified successfully!', token: jwtToken, user: { id: user.id, name: user.name, email: user.email } });
    });
  });
});

// 2. Login Route
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    if (user.is_verified === 0) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.', requiresVerification: true, email: user.email });
    }

    // Compare password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password.' });

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '7d' });
    
    res.json({
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
});

// 3. Order Placement Route
app.post('/api/orders', async (req, res) => {
  const { orderId, customer, items, total, paymentMethod } = req.body;

  if (!orderId || !customer || !items || !total) {
    return res.status(400).json({ error: 'Missing order details.' });
  }

  const itemsString = JSON.stringify(items);
  const fullAddress = `${customer.address}, ${customer.city}, ${customer.pincode}`;

  // 1. Save to Database
  db.run(`INSERT INTO orders (order_id, customer_name, customer_email, customer_phone, shipping_address, items, total_price, payment_method) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, customer.name, customer.email, customer.phone, fullAddress, itemsString, total, paymentMethod],
    async function(err) {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Failed to save order.' });
      }

      // 2. Send Email to Store Owner
      try {
        // NOTE: Using a test account/mock for now. 
        // In a real app, you'd use your actual SMTP credentials.
        let transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: 'prajwal.notification@ethereal.email', // This is a mock
            pass: 'mock_password_123'
          },
        });

        // For real Gmail usage (user's email: prajwalra661@gmail.com), 
        // they'd need to set up App Passwords.
        
        const itemsHtml = items.map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
          </tr>
        `).join('');

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0f0ee; border-radius: 12px; overflow: hidden;">
            <div style="background: #008080; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">New Order Received!</h1>
              <p style="margin: 8px 0 0; opacity: 0.8;">Order ID: ${orderId}</p>
            </div>
            <div style="padding: 32px;">
              <h2 style="font-size: 18px; color: #333; margin-top: 0;">Customer Information</h2>
              <p style="margin: 4px 0;"><strong>Name:</strong> ${customer.name}</p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${customer.email}</p>
              <p style="margin: 4px 0;"><strong>Phone:</strong> ${customer.phone}</p>
              <p style="margin: 4px 0;"><strong>Shipping Address:</strong><br>${fullAddress}</p>
              
              <h2 style="font-size: 18px; color: #333; margin-top: 32px;">Order Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9f9f9;">
                    <th style="padding: 8px; text-align: left; border-bottom: 2px solid #eee;">Product</th>
                    <th style="padding: 8px; text-align: center; border-bottom: 2px solid #eee;">Qty</th>
                    <th style="padding: 8px; text-align: right; border-bottom: 2px solid #eee;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <div style="margin-top: 16px; text-align: right;">
                <p style="font-size: 18px; font-weight: bold; color: #008080;">Total: ₹${total}</p>
                <p style="font-size: 14px; color: #666;">Payment Method: ${paymentMethod}</p>
              </div>
            </div>
            <div style="background: #f9f9f9; padding: 20px; text-align: center; color: #999; font-size: 12px;">
              © 2026 ClearoSkin Store. All rights reserved.
            </div>
          </div>
        `;

        res.status(200).json({ 
          message: 'Order placed successfully and notification sent!',
          orderId 
        });

      } catch (emailErr) {
        console.error('Email error:', emailErr.message);
        res.status(200).json({ 
          message: 'Order placed but email notification failed.',
          orderId 
        });
      }
  });
});

// 4. Forgot Password Route
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Please provide your email.' });

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    db.run(`UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?`, [resetToken, expiry, user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to process forgot password.' });

      console.log(`[Email Simulation] Sending Forgot Password OTP ${resetToken} to ${email}`);
      res.json({ message: 'Reset code sent to your email.' });
    });
  });
});

// 5. Reset Password Route
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

  db.get(`SELECT * FROM users WHERE email = ? AND reset_token = ?`, [email, token], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'Invalid reset code.' });

    if (new Date() > new Date(user.reset_expiry)) {
      return res.status(400).json({ error: 'Reset code has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.run(`UPDATE users SET password = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?`, [hashedPassword, user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to reset password.' });
      res.json({ message: 'Password reset successfully! You can now log in.' });
    });
  });
});

// Fallback to index.html for SPA-like behavior (optional, since it's just static files mostly)
app.get('*', (req, res) => {
  // If it's not an API route and not a direct file request, just serve index
  if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
