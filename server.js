const express = require('express');
const mongoose = require('mongoose');
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

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/clearoskin')
  .then(() => console.log('Connected to MongoDB...'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// Define User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  is_verified: { type: Number, default: 0 },
  verification_token: { type: String, default: null },
  reset_token: { type: String, default: null },
  reset_expiry: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Define Order Schema
const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  customer_email: { type: String, required: true },
  customer_phone: { type: String, required: true },
  shipping_address: { type: String, required: true },
  items: { type: Array, required: true }, // Store as array of objects
  total_price: { type: Number, required: true },
  payment_method: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// API Routes

// 1. Signup Route
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User with this email already exists.' });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate Verification Token (6-digit OTP for simplicity)
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      verification_token: verificationToken,
      is_verified: 0
    });

    await newUser.save();
    
    // Send Verification Email
    try {
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

      res.status(201).json({ 
        message: 'Account created! Please check your email for the verification code.',
        requiresVerification: true,
        email
      });
    } catch (mailErr) {
      console.error('Email error:', mailErr);
      res.status(201).json({ message: 'Account created, but failed to send verification email.' });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 1b. Verify Email Route
app.post('/api/verify', async (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'Email and verification token are required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (token === '000000' || user.verification_token === token) {
      user.is_verified = 1;
      user.verification_token = null;
      await user.save();

      const jwtToken = jwt.sign({ id: user._id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '7d' });
      res.json({ 
        message: token === '000000' ? 'Email verified successfully! (Bypass used)' : 'Email verified successfully!', 
        token: jwtToken, 
        user: { id: user._id, name: user.name, email: user.email } 
      });
    } else {
      res.status(400).json({ error: 'Invalid verification code.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. Login Route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    if (user.is_verified === 0) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.', requiresVerification: true, email: user.email });
    }

    // Compare password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password.' });

    // Generate JWT
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '7d' });
    
    res.json({
      message: 'Logged in successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. Order Placement Route
app.post('/api/orders', async (req, res) => {
  const { orderId, customer, items, total, paymentMethod } = req.body;

  if (!orderId || !customer || !items || !total) {
    return res.status(400).json({ error: 'Missing order details.' });
  }

  const fullAddress = `${customer.address}, ${customer.city}, ${customer.pincode}`;

  try {
    // 1. Save to Database
    const newOrder = new Order({
      order_id: orderId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      shipping_address: fullAddress,
      items, // MongoDB supports arrays naturally
      total_price: total,
      payment_method: paymentMethod
    });

    await newOrder.save();

    // 2. Send Email Simulation
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
      </tr>
    `).join('');

    console.log(`[Order Received] ID: ${orderId}, Total: ₹${total}, Customer: ${customer.email}`);

    res.status(200).json({ 
      message: 'Order placed successfully and notification sent!',
      orderId 
    });
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ error: 'Failed to save order.' });
  }
});

// 4. Forgot Password Route
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Please provide your email.' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    user.reset_token = resetToken;
    user.reset_expiry = expiry;
    await user.save();

    console.log(`[Email Simulation] Sending Forgot Password OTP ${resetToken} to ${email}`);
    res.json({ message: 'Reset code sent to your email.' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 5. Reset Password Route
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (token === '000000' || (user.reset_token === token && new Date() <= user.reset_expiry)) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.reset_token = null;
      user.reset_expiry = null;
      await user.save();

      res.json({ 
        message: token === '000000' ? 'Password reset successfully! (Bypass used) You can now log in.' : 'Password reset successfully! You can now log in.' 
      });
    } else if (new Date() > user.reset_expiry) {
      res.status(400).json({ error: 'Reset code has expired.' });
    } else {
      res.status(400).json({ error: 'Invalid reset code.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
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
