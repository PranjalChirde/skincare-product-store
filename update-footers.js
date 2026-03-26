const fs = require('fs');
const path = require('path');

const publicPagesDir = path.join(__dirname, 'public', 'pages');
const indexHtmlPaths = [
  path.join(__dirname, 'index.html'),
  path.join(publicPagesDir, 'cart.html'),
  path.join(publicPagesDir, 'login.html'),
  path.join(publicPagesDir, 'reset-password.html'),
  path.join(publicPagesDir, 'signup.html'),
  path.join(publicPagesDir, 'skin-analyzer.html'),
  path.join(publicPagesDir, 'verify.html')
];

const newFooter = `<footer id="footer">
  <div class="footer-inner">
    <div class="footer-col footer-brand">
      <div class="nav-logo">Clearo<span>Skin</span></div>
      <p>Dermatology-inspired skincare solutions for acne, oily skin, and dark spots.<br>Real science for real results.</p>
      <div class="footer-contact">
        <div class="contact-item"><span class="icon">📧</span> <a href="mailto:hello@clearoskin.com">hello@clearoskin.com</a></div>
        <div class="contact-item"><span class="icon">📞</span> <a href="tel:+18001234567">+1 (800) 123-4567</a></div>
        <div class="contact-item"><span class="icon">📍</span> 123 Clear Skin Ave, NY</div>
      </div>
    </div>
    <div class="footer-col">
      <h4>Quick Links</h4>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/#collections">Collections</a></li>
        <li><a href="/#products">Shop All</a></li>
        <li><a href="/public/pages/skin-analyzer.html">AI Skin Analyzer</a></li>
        <li><a href="/#testimonials">Reviews</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Support</h4>
      <ul>
        <li><a href="/#contact">Contact Us</a></li>
        <li><a href="#">FAQ</a></li>
        <li><a href="#">Shipping & Returns</a></li>
        <li><a href="/public/pages/cart.html">Track Order</a></li>
        <li><a href="#">Privacy Policy</a></li>
      </ul>
    </div>
    <div class="footer-col footer-newsletter">
      <h4>Join the Club</h4>
      <p>Exclusive offers, new drops, and skincare tips.</p>
      <form class="footer-newsletter-form" onsubmit="event.preventDefault(); alert('Subscribed!');">
        <input type="email" placeholder="Email address" required />
        <button type="submit">→</button>
      </form>
      <div class="footer-socials">
        <a href="#" class="social-btn">IG</a>
        <a href="#" class="social-btn">TK</a>
        <a href="#" class="social-btn">TW</a>
        <a href="#" class="social-btn">FB</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© 2026 ClearoSkin. All rights reserved. Made with ❤️ in India.</p>
    <div class="payment-icons">
      <span class="payment-icon">UPI</span>
      <span class="payment-icon">Visa</span>
      <span class="payment-icon">MC</span>
      <span class="payment-icon">RuPay</span>
    </div>
  </div>
</footer>`;

const footerRegex = /<footer[^>]*>[\s\S]*?<\/footer>/i;

let updated = 0;

for (const filePath of indexHtmlPaths) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (footerRegex.test(content)) {
      content = content.replace(footerRegex, newFooter);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${path.basename(filePath)}`);
      updated++;
    } else {
      console.log(`⚠️ Could not find footer in ${path.basename(filePath)}`);
    }
  } else {
     console.log(`❌ File not found: ${filePath}`);
  }
}

console.log(`Finished updating ${updated} files.`);
