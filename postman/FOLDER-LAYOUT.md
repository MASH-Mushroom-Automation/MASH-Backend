# MASH Backend - Postman Collections Folder Layout

## 📁 Flat Folder Structure (Exact Files)

This backend uses a single flat `postman/` directory. Import files directly without subfolders. Below is the canonical order and filenames to keep everything consistent when importing into Postman.

## 📂 Folder Layout

```
postman/
├── 00-Master-Complete-API-Collection.postman_collection.json
├── 01-Authentication-API.postman_collection.json
├── 02-System-Administration-Monitoring-API.postman_collection.json
├── 03-Categories-API.postman_collection.json
├── 04-Orders-API.postman_collection.json
├── 05-Products-API.postman_collection.json
├── 06-Sellers-Buyers-API.postman_collection.json
├── 08-CMS-API.postman_collection.json
├── 09-Payment-Gateway-API.postman_collection.json
├── 10-Admin-Dashboard-API.postman_collection.json
├── 11-Marketing-Affiliate-API.postman_collection.json
├── 12-Support-OTP-API.postman_collection.json
├── MASH-backend.postman_collection.json
├── MASH-Ecommerce-API.postman_collection.json
├── MASH-backend.postman_environment.json
├── FOLDER-LAYOUT.md
└── README.md
```

## Collection Descriptions

- **00-Master-Complete-API-Collection.postman_collection.json**: Master suite for end-to-end testing.
- **01-Authentication-API.postman_collection.json**: Firebase ID token exchange, email verification, JWT.
- **02-System-Administration-Monitoring-API.postman_collection.json**: Health checks and monitoring.
- **03-Categories-API.postman_collection.json**: Category CRUD and listing.
- **04-Orders-API.postman_collection.json**: Cart and order lifecycle.
- **05-Products-API.postman_collection.json**: Product CRUD and queries.
- **06-Sellers-Buyers-API.postman_collection.json**: Seller/buyer profiles and operations.
- **08-CMS-API.postman_collection.json**: CMS pages, blog, banners, SEO.
- **09-Payment-Gateway-API.postman_collection.json**: Payment methods, processing, refunds, webhooks.
- **10-Admin-Dashboard-API.postman_collection.json**: Admin analytics, users, products, orders, settings.
- **11-Marketing-Affiliate-API.postman_collection.json**: Campaigns, coupons, affiliates, newsletter.
- **12-Support-OTP-API.postman_collection.json**: Support tickets, OTP, FAQ, live chat.
- **MASH-backend.postman_collection.json**: Core backend utilities and auth flow helpers.
- **MASH-Ecommerce-API.postman_collection.json**: Consolidated eCommerce flows for the marketplace.
- **MASH-backend.postman_environment.json**: Shared environment variables.

## Import Order

1) Environment: `MASH-backend.postman_environment.json`
2) Core: `00-Master-Complete-API-Collection.postman_collection.json`, `01-Authentication-API.postman_collection.json`, `02-System-Administration-Monitoring-API.postman_collection.json`
3) eCommerce: `MASH-Ecommerce-API.postman_collection.json`, `05-Products-API.postman_collection.json`, `04-Orders-API.postman_collection.json`, `03-Categories-API.postman_collection.json`, `06-Sellers-Buyers-API.postman_collection.json`
4) CMS/Payments/Admin: `08-CMS-API.postman_collection.json`, `09-Payment-Gateway-API.postman_collection.json`, `10-Admin-Dashboard-API.postman_collection.json`
5) Marketing/Support: `11-Marketing-Affiliate-API.postman_collection.json`, `12-Support-OTP-API.postman_collection.json`
6) Utilities: `MASH-backend.postman_collection.json`

## Environment Variables

Use `MASH-backend.postman_environment.json` for:
- `baseUrl`, `accessToken`, `refreshToken`, `userId`, `firebaseIdToken`, `verificationCode`

## Quick Testing Paths

- Core health: 02-System-Administration-Monitoring-API → Health Monitoring
- Auth flow: 01-Authentication-API → Firebase → Email Verification → Refresh
- eCommerce happy path: MASH-Ecommerce-API → Register/Login → Products → Orders

---

**Last Updated**: September 29, 2025
**Version**: 1.0.0
**Status**: [x] Flat layout finalized
