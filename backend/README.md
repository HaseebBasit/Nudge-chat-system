# Nudge Chat — Backend Service

High-performance, secure, real-time messaging server powered by **Node.js, Express, Socket.IO, MongoDB Atlas, and MongoDB GridFS**.

---

## Features

- **ES Modules & Clean Architecture**: Modular, maintainable ES6+ code.
- **Authentication & Security**:
  - Secure bcryptjs password hashing.
  - JWT tokens for REST endpoints and Socket.IO handshakes.
  - 6-digit Email OTP with expiration, MongoDB persistence, and resend cooldowns.
  - Granular authorization checks on every private conversation, group, message, and media stream.
- **MongoDB Atlas Persistence**:
  - Strict Mongoose models for Users, Otps, Conversations, Groups, Messages, Reactions, and MessageReceipts.
  - Deterministic conversation key constraint preventing duplicate 1-to-1 chats.
  - Unread counts persisted and calculated from DB.
- **MongoDB GridFS Media Storage**:
  - Direct binary streaming for images, voice audio (`audio/webm`), and documents via `GridFSBucket`.
  - True binary streaming endpoints: `GET /media/:fileId` and `GET /api/media/:fileId`.
  - Browser-direct preview with auth token support.
- **Real-Time Socket.IO**:
  - Authorization-protected rooms (`private_<id>` and `group_<id>`).
  - Online/offline presence tracking without DB thrashing.
  - Real-time typing indicators.
  - Delivery and read receipts (`✓`, `✓✓`, Seen).
  - Instant emoji reactions, message edits, and soft deletes.

---

## Installation & Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in `backend/`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/nudgechat?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:5000

# Nodemailer SMTP (Optional for local dev - logs OTP to terminal if unset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM="Nudge Chat" <no-reply@nudgechat.com>
```

> **Note**: If `MONGODB_URI` is left blank during local development or automated testing, an automatic in-memory MongoDB instance will be used for zero-friction setup.

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Automated End-to-End Test Suite

Runs all 24 required end-to-end integration tests (Auth, OTP, Sockets, Media, GridFS, Permissions):

```bash
npm test
```

---

## REST API Reference

### Authentication
- `POST /api/auth/signup` — Register new user & send OTP
- `POST /api/auth/verify-email` — Verify 6-digit email OTP
- `POST /api/auth/resend-otp` — Resend verification or reset OTP
- `POST /api/auth/login` — Sign in with email & password
- `POST /api/auth/forgot-password` — Send password reset OTP
- `POST /api/auth/verify-reset-otp` — Verify reset code & issue reset token
- `POST /api/auth/reset-password` — Update password with reset token
- `GET  /api/auth/me` — Fetch authenticated user profile

### Users
- `GET   /api/users/search?q=` — Search users by name or email
- `PATCH /api/users/profile` — Update status message or avatar

### Private Conversations & Groups
- `GET  /api/conversations/private` — Get all 1-to-1 conversations with unread counts
- `POST /api/conversations/private` — Start or retrieve single unique conversation
- `GET  /api/conversations/:id/messages?page=1&limit=30` — Paginated chat history
- `POST /api/conversations/:id/messages` — Send message (text, image, voice, file)
- `POST /api/conversations/:id/read` — Mark conversation messages as seen
- `POST /api/groups` — Create new group
- `GET  /api/groups` — Get user's groups
- `GET  /api/groups/:groupId` — Get group members and details
- `POST /api/groups/:groupId/members` — Add member (admin only)
- `DELETE /api/groups/:groupId/members/:userId` — Remove member

### Messages & Reactions
- `PATCH  /api/messages/:messageId` — Edit own text message
- `DELETE /api/messages/:messageId` — Soft-delete own message
- `POST   /api/messages/:messageId/reactions` — Toggle emoji reaction

### Media (GridFS)
- `POST /api/media/upload` — Multipart form upload to MongoDB GridFS
- `GET  /media/:fileId` & `GET /api/media/:fileId` — Stream actual binary with MIME type
