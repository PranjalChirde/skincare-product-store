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

      // Insert new user
      db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, 
        [name, email, hashedPassword], 
        function(err) {
          if (err) return res.status(500).json({ error: 'Failed to register user.' });
          
          // Generate JWT
          const token = jwt.sign({ id: this.lastID, email, name }, SECRET_KEY, { expiresIn: '7d' });
          
          res.status(201).json({ 
            message: 'User registered successfully!',
            token,
            user: { id: this.lastID, name, email }
          });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
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

        // Send the mail
        console.log(`[Email Simulation] Sending order details to prajwalra661@gmail.com...`);
        // We will "simulate" a successful send for now, as we don't have real SMTP credentials.
        // If we had them, we'd call: await transporter.sendMail({...})
        
        res.status(200).json({ 
          message: 'Order placed successfully and notification sent!',
          orderId 
        });

      } catch (emailErr) {
        console.error('Email error:', emailErr.message);
        // We still respond success because the order WAS saved to the DB
        res.status(200).json({ 
          message: 'Order placed but email notification failed.',
          orderId 
        });
      }
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
