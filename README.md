# 🌿 ClearoSkin – Skincare Brand Store

A fully professional, high-converting skincare e-commerce store built with pure HTML, CSS, and JavaScript. Designed to look and feel like a real premium brand — ready to be ported to Shopify.

---

## 🚀 Quick Start

1. **Clone / Download** this repository to your machine.
2. Open `index.html` in any modern browser — no build tools required.
3. Navigate between pages using the navbar and product links.

```
index.html    ← Open this first
```

---

## 📁 File Structure

```
clearoskin/
├── index.html       # Homepage (9 sections)
├── product.html     # Product detail page (Anti-Acne Serum)
├── cart.html        # Shopping cart + checkout flow
├── style.css        # Global design system & all component styles
├── script.js        # Cart logic, animations, popups
└── README.md        # You are here
```

---

## 🎨 Brand Identity

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#FFFFFF` | Backgrounds |
| Secondary | `#EAF7F6` | Section fills, cards |
| Accent | `#00BFA6` | Buttons, CTAs, links |
| Heading | Poppins | All headings |
| Body | Open Sans | Paragraph text |

---

## 🛒 Products

| Product | Sale Price | Original |
|---------|-----------|----------|
| Acne Control Face Wash | ₹299 | ~~₹499~~ |
| Anti-Acne Serum | ₹699 | ~~₹999~~ |
| Oil-Free Moisturizer | ₹499 | ~~₹799~~ |
| Spot Removal Cream | ₹599 | ~~₹899~~ |

---

## ✨ Features

- **Persistent cart** — `localStorage`-based, survives page reloads
- **Sticky navbar** — scrolls with the page, shows cart count
- **Hero section** — animated floating cards + counter animations
- **Email popup** — shown after 5 seconds, once per session
- **Toast notifications** — feedback on every user action
- **Coupon code** — enter `CLEAR20` in cart for 20% off
- **Free shipping bar** — dynamic progress toward ₹499 threshold
- **Social proof ticker** — live-style urgency messages on product page
- **Scroll reveal animations** — elements animate in as you scroll
- **Fully responsive** — mobile hamburger menu + responsive grids
- **Checkout modal** — order success confirmation with order ID

---

## 🗂️ Homepage Sections

1. Announcement Bar
2. Sticky Navigation
3. Hero — *"Clear Skin Starts Here"*
4. Trust Strip
5. Featured Collections (Acne Treatment, Oil Control, Scar Removal)
6. Best-Selling Products
7. Benefits / USP
8. How It Works (4-step routine)
9. Key Ingredients
10. Customer Testimonials
11. Trust Badges
12. Newsletter Signup
13. Footer

---

## 🛍️ Product Page Features

- Image gallery with thumbnail switcher
- Size variant selector
- Quantity control
- Sticky "Get Clear Skin Now" Add-to-Cart bar
- Benefits / Ingredients / How to Use — tabbed sections
- Customer reviews
- Related products upsell

---

## 🏪 Migrating to Shopify

To deploy this design on a real Shopify store:

1. **Theme**: Use Dawn or Sense as the base theme.
2. **Templates**: Convert each HTML section into a `.liquid` template file.
3. **Assets**: Place `style.css` and `script.js` in `assets/`.
4. **Products**: Add products via Shopify Admin → Products.
5. **Apps to install**:
   - [Judge.me](https://judge.me) — reviews & social proof
   - Shopify Search & Discovery — filters
   - Shopify Bundles — bundle deals / AOV
   - Klaviyo or Privy — email popups & newsletters

---

## 📄 License

This project is for personal / commercial use. Free to adapt for your own Shopify or web store.

---

*Built with ❤️ for ClearoSkin — Clear Skin Starts Here.*
