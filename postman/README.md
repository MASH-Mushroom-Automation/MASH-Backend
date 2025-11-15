Postman collection for MASH-backend

## 📦 Available Collections

### Core Collections
- `MASH-backend.postman_collection.json` — Legacy complete collection
- `00-Master-Complete-API-Collection.postman_collection.json` — Master collection with all endpoints

### Feature-Specific Collections
- `01-Authentication-API.postman_collection.json` — Auth endpoints (register, login, JWT)
- `02-System-Administration-Monitoring-API.postman_collection.json` — Admin & monitoring
- `03-Categories-API.postman_collection.json` — Product categories
- `04-Orders-API.postman_collection.json` — Order management
- `05-Products-API.postman_collection.json` — Product CRUD
- `06-Sellers-Buyers-API.postman_collection.json` — User management
- `07-IoT-Device-Management-API.postman_collection.json` — IoT devices
- `08-CMS-API.postman_collection.json` — Content management
- `09-Payment-Gateway-API.postman_collection.json` — Payment processing
- `10-Admin-Dashboard-API.postman_collection.json` — Dashboard analytics
- `11-Marketing-Affiliate-API.postman_collection.json` — Marketing features
- `12-Support-OTP-API.postman_collection.json` — Support & OTP
- `13-User-Profile-Management-API.postman_collection.json` — User profiles
- `14-Import-Export-API.postman_collection.json` — Data import/export
- **`15-Cart-API.postman_collection.json`** — 🆕 **Shopping Cart System** (NEW!)
- `99-Complete-Auth-Flow-Testing.postman_collection.json` — Auth flow tests

### 🛒 NEW: Cart API Collection

The **Cart API collection** (`15-Cart-API.postman_collection.json`) includes comprehensive tests for:

**Guest Cart Operations:**
- Get/create guest cart
- Add items to cart
- Update item quantities
- Remove items
- Clear entire cart
- Get cart summary

**Authenticated User Cart:**
- Get user cart
- Merge guest cart to user cart (on login)

**Validation & Checkout:**
- Validate cart before checkout
- Estimate shipping costs
- Complete checkout process

**Analytics (Admin):**
- Get cart overview
- Track abandoned carts

**Error Scenarios:**
- Out of stock handling
- Invalid product errors
- Empty cart checkout

**Quick Start:**
1. Import `15-Cart-API.postman_collection.json`
2. Set `baseUrl` to `http://localhost:3000/api/v1`
3. Generate session ID: `[guid]::NewGuid().ToString()`
4. Set `guestSessionId` in environment
5. Run collection!

For detailed cart testing, see: `docs/CART_TESTING_GUIDE.md`

### Environment File
- `MASH-backend.postman_environment.json` — Environment variables for all collections

Quick steps (PowerShell)

1. Ensure the backend is running locally (default: http://localhost:3000):

```powershell
# from the mash-backend folder
npm run start:dev
```

2. Import the collection into Postman:
- Open Postman → Import → Choose Files → select `MASH-backend.postman_collection.json`.
- Set the collection variable `baseUrl` to `http://localhost:3000` if not already set.

Authentication (Firebase REST API)
 - To obtain a Firebase ID token via the REST API you can call the Sign In endpoint with your Firebase Web API key.
 - Set `firebaseApiKey` in the Postman environment (or set it before running the request).
 - Use the included requests `Firebase - Sign Up (REST)` or `Firebase - Sign In (REST)` to create/login a user. The response will save `firebaseIdToken` into the environment (Postman test script).

Backend register/login
- The collection now includes `Auth - Register (example)` and `Auth - Login (example)` which call the backend endpoints `POST /auth/register` and `POST /auth/login`.
- These backend endpoints proxy to Firebase REST API and return both the Firebase response and the upserted Prisma user. The Postman tests will save the Firebase tokens into the environment so subsequent requests (like `/users/me`) are authorized.

Emulator vs Production
- To test safely locally use the Firebase Emulator Suite (recommended).
- If you use the emulator, set the environment variable `firebaseEmulatorHost` to the emulator's auth host (default: http://127.0.0.1:9099). The collection will rewrite REST endpoints to use the emulator when this variable is set.

PowerShell quick-run (emulator):

```powershell
# 1) start the firebase auth emulator (in its own terminal)
npx firebase emulators:start --only auth

# 2) start the backend (in another terminal)
npm run start:dev

# 3) run the Postman collection via Newman (uses the environment file)
npx newman run .\postman\MASH-backend.postman_collection.json --environment .\postman\MASH-backend.postman_environment.json

Example sequence (PowerShell):

```powershell
# 1) start Firebase Auth emulator in one terminal
npx firebase emulators:start --only auth

# 2) start the backend in another terminal
npm run start:dev

# 3) in a third terminal run the Postman collection via Newman
npx newman run .\postman\MASH-backend.postman_collection.json --environment .\postman\MASH-backend.postman_environment.json
```
```

3. Optional: run the collection from the command line with Newman (install globally or use npx):

```powershell
# install newman once (optional)
npm install -g newman

# run collection
npx newman run .\postman\MASH-backend.postman_collection.json --env .\postman\MASH-backend.postman_environment.json

# or using npx
npx newman run .\postman\MASH-backend.postman_collection.json --env-var "baseUrl=http://localhost:3000"
```

Notes
- The collection contains only a few example requests (root and health). Add more requests (users, auth, telemetry) as you implement API endpoints.
- If you use a different port or have a `/api` global prefix, set `baseUrl` accordingly (for example `http://localhost:3000/api`).
