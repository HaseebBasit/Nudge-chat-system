# Nudge Chat — Frontend Client

A responsive real-time web application built with **React, Vite, React Router, Socket.IO Client, and CSS**.

---

## Features

- **Original Nudge Chat Identity**: Clean, messaging-first interface (NOT a WhatsApp clone).
- **Responsive Layout**:
  - **Desktop**: Split layout with persistent 360px sidebar and full-featured main chat area.
  - **Mobile**: Seamless transition between conversation list and active chat screen with a back button.
- **Real-Time Communication**:
  - Real-time messages with sound/visual indicators.
  - Real-time typing indicators.
  - Active presence (online / offline dots).
  - Delivery and read receipts (`✓`, `✓✓`, Seen).
  - Unread count badges that persist across page reloads.
- **Rich Media & Interactive Controls**:
  - Custom Nudge Voice Player with seek bar, play/pause, and duration counter.
  - Live audio recorder using the browser `MediaRecorder API` with pulse indicator and timer.
  - Image messages with responsive thumbnails and fullscreen viewer modal.
  - File attachments (PDF, DOC, ZIP) with file size and direct download links.
  - Reply preview bar and quote blocks.
  - Emoji picker and quick reactions.
- **Complete Authentication UI**:
  - Sign Up, Login, 6-digit OTP verification with paste support, Forgot Password, and Reset Password.

---

## Installation & Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Start Development Server

```bash
npm run dev
```

The application will run at `http://localhost:3000`.

### 4. Build for Production

```bash
npm run build
```

The compiled assets will be placed in the `dist/` directory, ready to deploy to Vercel, Netlify, or any static hosting service.
