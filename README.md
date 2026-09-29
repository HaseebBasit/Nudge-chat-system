# NUDGE CHAT — Full-Stack Real-Time Messaging Platform

**Nudge Chat** is a modern, production-ready, full-stack real-time messaging application built completely from scratch with an original design identity and robust security architecture.

---

## 🏗️ Architecture Overview

```text
                             NUDGE CHAT
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
           React / Vite                   Socket.IO Client
                │                                 │
                └────────────────┬────────────────┘
                                 │
                          REST + WebSockets
                                 │
                         Node.js + Express
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
             Mongoose                        Socket.IO
                 │                               │
                 ▼                               ▼
           MongoDB Atlas                  Real-Time Events
                 │
        ┌────────┴────────┐
        │                 │
   Collections         GridFS
        │                 │
        ├─ Users          ├─ Images
        ├─ OTPs           ├─ Voice Notes (audio/webm)
        ├─ Conversations  ├─ Files (PDF, Docs, Zip)
        ├─ Groups         └─ Other Attachments
        ├─ Messages
        ├─ Reactions
        └─ Receipts
```

### Core Architecture Rules:
1. **MongoDB is the Persistent Source of Truth**: All users, OTPs, conversations, messages, reactions, receipts, and unread counts are stored in MongoDB Atlas.
2. **GridFS for Binary Media**: Images, voice recordings, and file attachments are stored as chunks in MongoDB GridFS (`GridFSBucket`), never on the ephemeral local filesystem.
3. **True Binary Streaming**: The `GET /media/:fileId` endpoint streams raw binary data directly with correct MIME types (`image/png`, `audio/webm`, `application/pdf`), allowing direct browser viewing and `<audio controls>` playback.
4. **REST API for Mutation**: Messages, edits, deletes, and reactions are persisted in MongoDB first, then broadcast to Socket.IO rooms.
5. **Strict Authorization**: Every route and Socket.IO room verifies JWT authentication and participant/group membership. User C can never eavesdrop, send messages, or view media in User A & B's private chat.

---

## 📁 Project Structure

```text
Nudge-Chat/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                # MongoDB Atlas connection & auto-fallback
│   │   │   └── gridfs.js            # GridFSBucket streaming utilities
│   │   ├── controllers/
│   │   │   ├── authController.js    # Signup, OTP verification, Login, Password Reset
│   │   │   ├── conversationController.js # 1-to-1 chats, messages, read receipts
│   │   │   ├── groupController.js   # Group creation, admin management
│   │   │   ├── mediaController.js   # GridFS upload & direct binary stream
│   │   │   ├── messageController.js # Edit, soft delete, emoji reactions
│   │   │   └── userController.js    # User search & profile update
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js    # JWT verification (Bearer & query token)
│   │   │   ├── errorMiddleware.js   # Safe centralized error handler
│   │   │   └── uploadMiddleware.js  # Multer memory storage (25MB limit)
│   │   ├── models/
│   │   │   ├── Conversation.js      # Unique 1-to-1 conversation model
│   │   │   ├── Group.js             # Group chat model
│   │   │   ├── Message.js           # Text, Image, Voice, File message model
│   │   │   ├── MessageReceipt.js    # Sent, Delivered, Seen receipts
│   │   │   ├── Otp.js               # 6-digit OTP model with TTL expiry
│   │   │   ├── Reaction.js          # Emoji reactions model
│   │   │   └── User.js              # User model with bcrypt passwords
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── conversationRoutes.js
│   │   │   ├── groupRoutes.js
│   │   │   ├── mediaRoutes.js
│   │   │   ├── messageRoutes.js
│   │   │   └── userRoutes.js
│   │   ├── services/
│   │   │   ├── emailService.js      # Nodemailer OTP email service
│   │   │   └── otpService.js        # OTP creation, TTL, and validation
│   │   ├── sockets/
│   │   │   ├── socketAuth.js        # Socket handshake JWT verification
│   │   │   ├── socketEmitter.js     # Global emitter for controllers
│   │   │   └── socketHandler.js     # Presence, typing, and room events
│   │   ├── utils/
│   │   │   ├── jwt.js               # JWT sign/verify
│   │   │   └── validation.js        # Email/password validation
│   │   ├── app.js                   # Express application setup
│   │   └── server.js                # HTTP + Socket.IO server startup
│   ├── tests/
│   │   └── endToEnd.test.js         # Comprehensive 24-test integration suite
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   │   ├── ChatArea.jsx         # Main chat container
│   │   │   │   ├── ChatHeader.jsx       # Header with online/typing state & back button
│   │   │   │   ├── GroupModal.jsx       # Group creation & member management
│   │   │   │   ├── ImageViewerModal.jsx # Fullscreen image lightbox
│   │   │   │   ├── MessageComposer.jsx  # Text, emoji, attachments, voice recorder
│   │   │   │   ├── MessageItem.jsx      # Message bubble with reactions & status ticks
│   │   │   │   ├── MessageList.jsx      # Scrollable list with pagination
│   │   │   │   ├── SearchModal.jsx      # User search and chat initiator
│   │   │   │   ├── Sidebar.jsx          # Conversation & group list with unread badges
│   │   │   │   └── VoicePlayer.jsx      # Custom Nudge audio player
│   │   │   └── Common/
│   │   │       ├── Avatar.jsx           # Initials + GridFS photo avatar
│   │   │       └── Modal.jsx            # Reusable modal component
│   │   ├── context/
│   │   │   ├── AuthContext.jsx          # User credentials & state
│   │   │   └── SocketContext.jsx        # Socket.IO connection & presence
│   │   ├── hooks/
│   │   │   └── useVoiceRecorder.js      # MediaRecorder API integration
│   │   ├── pages/
│   │   │   ├── ChatDashboardPage.jsx    # Real-time chat dashboard
│   │   │   ├── ForgotPasswordPage.jsx   # Request password reset OTP
│   │   │   ├── LoginPage.jsx            # Email + Password login
│   │   │   ├── ResetPasswordPage.jsx    # Enter OTP & new password
│   │   │   ├── SignupPage.jsx           # User registration
│   │   │   └── VerifyEmailPage.jsx      # 6-digit OTP email verification
│   │   ├── services/
│   │   │   ├── api.js                   # Universal fetch wrapper
│   │   │   ├── authService.js           # Auth REST endpoints
│   │   │   ├── chatService.js           # Conversations, messages, groups
│   │   │   └── mediaService.js          # GridFS upload and URL generator
│   │   ├── styles/
│   │   │   ├── auth.css                 # Auth cards & OTP input boxes
│   │   │   ├── chat.css                 # Responsive layout & header/composer
│   │   │   ├── components.css           # Bubbles, voice player, reactions
│   │   │   └── main.css                 # Design tokens & color system
│   │   ├── utils/
│   │   │   └── formatTime.js            # Time, duration, and file size formatters
│   │   ├── App.jsx                      # Protected route guards
│   │   └── main.jsx                     # Vite mount
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### 1. Start Backend

```bash
cd backend
npm install
npm start
```
*Backend runs on `http://localhost:5000`.*
*(If no `MONGODB_URI` is provided, an automatic in-memory MongoDB instance will start up).*

### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 🧪 Automated End-to-End Test Suite

Run the full integration test suite verifying all 24 requirements from section 65:

```bash
cd backend
npm test
```

### Verified Test Cases:
- **Test 1**: User A, B, C signup + 6-digit MongoDB Email OTP verification.
- **Test 2**: User search + unique private conversation creation (verified zero duplicates).
- **Test 3**: A sends text message -> B receives instantly via Socket.IO.
- **Test 4**: B replies referencing original message -> A receives reply instantly.
- **Test 5**: Simulated refresh: messages reload from MongoDB source of truth.
- **Test 6**: C attempts accessing A/B conversation -> rejected with 403 Forbidden.
- **Test 7**: C attempts joining A/B Socket.IO room -> rejected with Unauthorized error.
- **Test 8**: A types -> B sees typing indicator -> C does not.
- **Test 9**: B opens chat -> message marked seen -> A receives real-time `✓✓` seen status.
- **Test 10 & 11**: Unread counts persist in database and reset to 0 when opened.
- **Test 12 & 13**: Real-time emoji reactions: add reaction and toggle to remove.
- **Test 14**: Message edit by sender updates in real-time.
- **Test 15**: Soft delete updates content to `"This message was deleted"` in real-time.
- **Test 16**: Image uploaded to MongoDB GridFS -> `GET /media/:fileId` streams actual binary with `image/png`.
- **Test 17**: Voice recording uploaded to GridFS -> `GET /media/:fileId` streams playable `audio/webm`.
- **Test 18**: File attachments stored and downloaded from GridFS with proper `application/pdf` MIME type.
- **Test 19**: Group chat creation (A + B + C) with real-time broadcast to all members.
- **Test 20 & 21**: Strict isolation: group messages never appear in private chat; private messages never appear in group chat.
- **Test 22 & 23**: Security checks: User C cannot edit or delete User A's messages.
- **Test 24**: Logout cleanly disconnects socket; protected APIs reject unauthenticated requests (401).

---

## 🚀 Production Deployment Guide

### 1. MongoDB Atlas Setup
1. Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Go to **Database Access** -> create a database user with Read/Write privileges.
3. Go to **Network Access** -> Add IP address `0.0.0.0/0` (allow access from anywhere, or specify Render's IPs).
4. Click **Connect** -> **Connect your application** -> copy the connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/nudgechat?retryWrites=true&w=majority
   ```

### 2. Backend Deployment on Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your Git repository.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `PORT`: `5000`
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `JWT_SECRET`: `<A strong random secret key>`
   - `CLIENT_URL`: `https://your-frontend.vercel.app`
   - `SERVER_URL`: `https://your-backend.onrender.com`
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `your_email@gmail.com`
   - `SMTP_PASS`: `your_gmail_app_password`

### 3. Frontend Deployment on Vercel
1. Create a new project on [Vercel](https://vercel.com).
2. Connect your Git repository.
3. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variables:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
   - `VITE_SOCKET_URL`: `https://your-backend.onrender.com`
5. Deploy!
