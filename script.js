/* =============================================
   ClearoSkin — Main JavaScript
   Handles: Cart, Navbar, Animations, Popups, Toast
   ============================================= */

/* ── CART MANAGEMENT ── */
function getCart() {
  return JSON.parse(localStorage.getItem('clearo_cart') || '[]');
}
function saveCart(cart) {
  localStorage.setItem('clearo_cart', JSON.stringify(cart));
}

function addToCart(id, name, price, btn) {
  const cart = getCart();
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }
  saveCart(cart);
  updateCartCount();
  showToast(`✅ ${name} added to cart!`);

  // Button feedback
  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.classList.add('added');
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('added');
      btn.disabled = false;
    }, 1800);
  }

  // Show sticky cart after first add
  const stickyCart = document.getElementById('sticky-cart');
  if (stickyCart) stickyCart.classList.add('visible');
}

function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('#cart-count').forEach(el => {
    el.textContent = total;
    el.style.display = total === 0 ? 'none' : 'flex';
  });
  // Update sticky cart button
  const stickyCount = document.getElementById('sticky-cart-count');
  if (stickyCount) {
    stickyCount.textContent = total + (total === 1 ? ' item' : ' items');
  }
  // Keep sticky visible if items exist
  const stickyCart = document.getElementById('sticky-cart');
  if (stickyCart) {
    stickyCart.classList.toggle('visible', total > 0);
  }
}

/* ── WISHLIST TOGGLE ── */
function toggleWishlist(el) {
  el.classList.toggle('active');
  el.querySelector('.heart-icon').textContent = el.classList.contains('active') ? '❤️' : '🤍';
  showToast(el.classList.contains('active') ? 'Added to wishlist ❤️' : 'Removed from wishlist');
}

/* ── TOAST NOTIFICATION ── */
function showToast(msg, icon = '✅') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast) return;
  toastMsg.textContent = msg;
  toast.querySelector('.toast-icon').textContent = icon;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ── NAVBAR: Sticky Shadow ── */
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
});

/* ── MOBILE NAV ── */
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const closeMobileNav = document.getElementById('close-nav');
  const mobileNavBg = document.getElementById('mobile-nav-bg');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => mobileNav.classList.add('open'));
    if (closeMobileNav) closeMobileNav.addEventListener('click', () => mobileNav.classList.remove('open'));
    if (mobileNavBg) mobileNavBg.addEventListener('click', () => mobileNav.classList.remove('open'));
  }

  /* ── SCROLL REVEAL ANIMATION ── */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* ── EMAIL POPUP (shown after 5 seconds, once per session) ── */
  if (!sessionStorage.getItem('popup_shown')) {
    setTimeout(() => {
      const popup = document.getElementById('email-popup');
      if (popup) {
        popup.style.display = 'flex';
        sessionStorage.setItem('popup_shown', '1');
      }
    }, 5000);
  }

  /* ── UPDATE CART COUNT ON LOAD ── */
  updateCartCount();

  /* ── SMOOTH SCROLL for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close mobile nav if open
        const mNav = document.getElementById('mobile-nav');
        if (mNav) mNav.classList.remove('open');
      }
    });
  });

  /* ── HERO Image Parallax (subtle) ── */
  const heroWrap = document.querySelector('.hero-img-wrap img');
  if (heroWrap) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < 800) {
        heroWrap.style.transform = `translateY(${scrolled * 0.08}px)`;
      }
    });
  }

  /* ── Number Counter Animation ── */
  const counters = document.querySelectorAll('.hero-stat strong');
  counters.forEach(counter => {
    const text = counter.textContent;
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    const suffix = text.replace(/[0-9.]/g, '');
    if (isNaN(num)) return;
    let start = 0;
    const duration = 1500;
    const step = num / (duration / 16);
    const counterObs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const timer = setInterval(() => {
          start = Math.min(start + step, num);
          counter.textContent = (Number.isInteger(num) ? Math.floor(start) : start.toFixed(1)) + suffix;
          if (start >= num) clearInterval(timer);
        }, 16);
        counterObs.unobserve(counter);
      }
    });
    counterObs.observe(counter);
  });
});

/* ── NEWSLETTER SUBMIT ── */
function handleNewsletterSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('newsletter-email').value;
  showToast(`🎉 Welcome! Check ${email} for your 20% off code.`, '🎉');
  e.target.reset();
}

/* ── EMAIL POPUP SUBMIT ── */
function handlePopupSubmit(e) {
  e.preventDefault();
  closePopup();
  setTimeout(() => showToast('🎉 Coupon CLEAR20 applied! Enjoy 20% off.', '🎉'), 500);
}
function closePopup() {
  const popup = document.getElementById('email-popup');
  if (popup) popup.style.display = 'none';
}

/* ── AUTHENTICATION ── */
const API_URL = 'http://localhost:3000/api';

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('signup-error');
  const successDiv = document.getElementById('signup-success');
  const btn = e.target.querySelector('button');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing up...';

  try {
    const res = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to sign up');
    }

    if (data.requiresVerification) {
      successDiv.style.display = 'block';
      successDiv.textContent = data.message;
      setTimeout(() => {
        window.location.href = `verify.html?email=${encodeURIComponent(email)}`;
      }, 2000);
      return;
    }

    // Save token
    localStorage.setItem('clearo_token', data.token);
    localStorage.setItem('clearo_user', JSON.stringify(data.user));
    
    successDiv.style.display = 'block';
    successDiv.textContent = 'Account created successfully! Redirecting...';
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);

  } catch (error) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = error.message;
    btn.disabled = false;
    btn.textContent = 'Sign Up';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');
  const btn = e.target.querySelector('button');

  errorDiv.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to login');
    }

    // Save token
    localStorage.setItem('clearo_token', data.token);
    localStorage.setItem('clearo_user', JSON.stringify(data.user));
    
    window.location.href = 'index.html';

  } catch (error) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = error.message;
    btn.disabled = false;
    btn.textContent = 'Log In';

    if (error.message.includes('verify your email')) {
      const email = document.getElementById('email').value;
      setTimeout(() => {
        window.location.href = `verify.html?email=${encodeURIComponent(email)}`;
      }, 2500);
    }
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  const btn = e.target.querySelector('button');
  const errorDiv = document.getElementById('forgot-error');
  const successDiv = document.getElementById('forgot-success');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to send reset code');

    successDiv.style.display = 'block';
    successDiv.textContent = data.message;
    setTimeout(() => window.location.href = 'reset-password.html', 3000);
  } catch (err) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = err.message;
    btn.disabled = false;
  }
}

function handleLogout() {
  localStorage.removeItem('clearo_token');
  localStorage.removeItem('clearo_user');
  window.location.href = 'index.html';
}

function checkAuth() {
  const token = localStorage.getItem('clearo_token');
  const userStr = localStorage.getItem('clearo_user');
  
  if (token && userStr) {
    const user = JSON.parse(userStr);
    const loginBtn = document.getElementById('nav-login-btn');
    const signupBtn = document.getElementById('nav-signup-btn');
    
    if (loginBtn && signupBtn) {
      // Create user profile dropdown or just text
      const navActions = loginBtn.parentElement;
      
      loginBtn.remove();
      signupBtn.remove();
      
      const userBadge = document.createElement('div');
      userBadge.style.display = 'flex';
      userBadge.style.alignItems = 'center';
      userBadge.style.gap = '12px';
      userBadge.innerHTML = `
        <span style="font-family: var(--font-head); font-size: 0.85rem; font-weight: 600; color: var(--teal-dark);">
          Hi, ${user.name.split(' ')[0]}
        </span>
        <button onclick="handleLogout()" class="btn btn-outline btn-sm" style="padding: 6px 14px; font-size: 0.75rem;">Logout</button>
      `;
      
      // Insert before hamburger if it exists
      const hamburger = document.getElementById('hamburger-btn');
      if (hamburger) {
        navActions.insertBefore(userBadge, hamburger);
      } else {
        navActions.appendChild(userBadge);
      }
    }
  }
}

// Run auth check on load
document.addEventListener('DOMContentLoaded', checkAuth);
