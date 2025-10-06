Postman collection for MASH-backend

Files
- `MASH-backend.postman_collection.json` — Postman collection you can import into Postman or run with Newman.

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
