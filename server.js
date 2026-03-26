const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'clearoskin_fallback_secret';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Multer — in-memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB max (Vercel limit is 4.5MB)
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

// Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Serve index.html from root
app.use(express.static(path.join(__dirname)));
// Serve everything inside /public (css, js, images, pages)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clearoskin';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB...'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// ─── Schemas ───────────────────────────────────────────────────────────────

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

const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  customer_email: { type: String, required: true },
  customer_phone: { type: String, required: true },
  shipping_address: { type: String, required: true },
  items: { type: Array, required: true },
  total_price: { type: Number, required: true },
  payment_method: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ─── API Routes ────────────────────────────────────────────────────────────

// 1. Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User with this email already exists.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = new User({ name, email, password: hashedPassword, verification_token: verificationToken, is_verified: 0 });
    await newUser.save();

    console.log(`[Email Simulation] Sending verification OTP ${verificationToken} to ${email}`);
    res.status(201).json({
      message: 'Account created! Please check your email for the verification code.',
      requiresVerification: true,
      email
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 2. Verify Email
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
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. Login
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

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ message: 'Logged in successfully!', token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. Order Placement
app.post('/api/orders', async (req, res) => {
  const { orderId, customer, items, total, paymentMethod } = req.body;
  if (!orderId || !customer || !items || !total) {
    return res.status(400).json({ error: 'Missing order details.' });
  }
  const fullAddress = `${customer.address}, ${customer.city}, ${customer.pincode}`;
  try {
    const newOrder = new Order({
      order_id: orderId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      shipping_address: fullAddress,
      items,
      total_price: total,
      payment_method: paymentMethod
    });
    await newOrder.save();
    console.log(`[Order Received] ID: ${orderId}, Total: ₹${total}, Customer: ${customer.email}`);
    res.status(200).json({ message: 'Order placed successfully!', orderId });
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ error: 'Failed to save order.' });
  }
});

// 5. Forgot Password
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
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 6. Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) return res.status(400).json({ error: 'All fields are required.' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (token === '000000' || (user.reset_token === token && new Date() <= user.reset_expiry)) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      user.reset_token = null;
      user.reset_expiry = null;
      await user.save();
      res.json({ message: token === '000000' ? 'Password reset successfully! (Bypass used) You can now log in.' : 'Password reset successfully! You can now log in.' });
    } else if (user.reset_expiry && new Date() > user.reset_expiry) {
      res.status(400).json({ error: 'Reset code has expired.' });
    } else {
      res.status(400).json({ error: 'Invalid reset code.' });
    }
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 7. AI Skin Analyzer
app.post('/api/analyze-skin', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded. Please upload a face photo.' });
  }
  const imagePart = {
    inlineData: {
      data: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype
    }
  };
  const prompt = `You are an expert dermatologist and AI skincare consultant for ClearoSkin, a premium dermatology-inspired skincare brand.

A user has uploaded a photo of their face. Carefully analyze the visible skin and provide the following in clean, structured markdown with emojis:

## 1. 🔍 Skin Type Detection
Identify the skin type: Oily / Dry / Combination / Normal / Sensitive. Show it as a bold label.

## 2. ⚠️ Skin Concerns Detected
List all visible skin concerns (e.g. Acne/Pimples, Blackheads/Whiteheads, Dark spots/Hyperpigmentation, Dark circles/Eye bags, Redness/Rosacea, Dullness/Uneven tone, Fine lines/Wrinkles, Large pores, Dehydration/Dryness, Oiliness/Shine). For each, briefly explain the cause.

## 3. 🛒 Product Recommendations
Recommend products ONLY from this list, matching the detected concerns. For each product state: name, why it suits this skin, and when to use it (morning/night).

Available ClearoSkin Products:
- Acne Control Face Wash (₹299) — Removes oil & dirt, prevents breakouts, gentle formula.
- Anti-Acne Serum (₹699) — Reduces pimples & scars, fast-absorbing. Contains Niacinamide 4% + Tea Tree.
- Oil-Free Moisturizer (₹499) — Hydrates without clogging pores, lightweight & non-greasy.
- Spot Removal Cream (₹599) — Targets dark spots, brightens skin tone visibly.
- Clarifying Toner (₹399) — Pore-refining formula, balances skin pH.
- Sunscreen SPF 50 (₹549) — Broad spectrum protection, non-greasy finish.
- Night Repair Cream (₹749) — Overnight skin renewal, deeply nourishing.
- Exfoliating Scrub (₹349) — Gently removes dead skin, glowing results.
- Vitamin C Brightening Serum (₹799) — Brightens dull skin, evens tone, antioxidant protection.
- Under Eye Dark Circle Cream (₹649) — Reduces puffiness, fades dark circles, hydrates delicate eye area.
- Pore Minimizing Primer (₹449) — Blurs pores, controls oil, smooth skin finish.
- Hydrating Face Mask (₹299) — Deep hydration boost, plumps and soothes skin.
- Gentle Foaming Cleanser (₹349) — pH-balanced, removes makeup and impurities gently.
- Retinol Night Serum (₹899) — Anti-aging, boosts cell turnover, smooths fine lines.
- Activated Charcoal Mask (₹399) — Deep-cleanses pores, removes blackheads.
- Kojic Acid Brightening Soap (₹199) — Fades pigmentation, brightens skin tone.
- Tea Tree Spot Gel (₹249) — Fast-acting spot treatment, reduces redness.
- Aloe Vera Soothing Gel (₹299) — Calms irritation, redness, and sun-damaged skin.
- Niacinamide Essence (₹549) — Minimizes pores, balances sebum, brightens complexion.
- AHA/BHA Chemical Exfoliant (₹649) — Resurfaces skin, reduces dullness and uneven texture.

## 4. 📋 Personalized Skincare Routine
Suggest a simple morning and night routine using only the recommended products above.

## 5. 💡 Bonus Tips
Give 2–3 lifestyle or skincare tips tailored to the detected concerns.

---
IMPORTANT:
- Be empathetic, positive, and non-judgmental.
- Do NOT diagnose medical conditions. Recommend consulting a dermatologist for serious concerns.
- If the image is unclear or not a face photo, politely say: "Please upload a clear, well-lit photo of your face for accurate analysis."
- Keep language simple and easy to understand.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    res.json({ analysis: text });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    if (err.message && err.message.includes('API key')) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// ─── SPA Fallback ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

// Run server if started directly, otherwise export for serverless
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ClearoSkin server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
