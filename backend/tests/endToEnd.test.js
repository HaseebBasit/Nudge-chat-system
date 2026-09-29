import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Otp } from '../src/models/Otp.js';
import { Conversation } from '../src/models/Conversation.js';
import { Group } from '../src/models/Group.js';
import { Message } from '../src/models/Message.js';
import { Reaction } from '../src/models/Reaction.js';
import { MessageReceipt } from '../src/models/MessageReceipt.js';
import { socketAuthMiddleware } from '../src/sockets/socketAuth.js';
import { registerSocketHandlers } from '../src/sockets/socketHandler.js';
import { setIO } from '../src/sockets/socketEmitter.js';
import { uploadBufferToGridFS } from '../src/config/gridfs.js';

let mongod;
let server;
let port;
let baseUrl;

// Test client contexts
let userA = { name: 'Alice Walker', email: 'alice@nudge.test', password: 'password123', token: null, id: null, socket: null };
let userB = { name: 'Bob Smith', email: 'bob@nudge.test', password: 'password123', token: null, id: null, socket: null };
let userC = { name: 'Charlie Brown', email: 'charlie@nudge.test', password: 'password123', token: null, id: null, socket: null };

let privateConvId = null;
let testMessageId = null;
let imageMediaId = null;
let voiceMediaId = null;
let fileMediaId = null;
let groupId = null;

// Helper to make HTTP requests
const request = async (endpoint, options = {}, token = null) => {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, data };
  } else {
    const buffer = await res.arrayBuffer();
    return { status: res.status, headers: res.headers, buffer: Buffer.from(buffer) };
  }
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
};

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('🚀 STARTING COMPREHENSIVE NUDGE CHAT END-TO-END TEST SUITE');
  console.log('=============================================================\n');

  try {
    // ---- SETUP DATABASE & HTTP/SOCKET SERVER ----
    console.log('[Setup] Starting in-memory MongoDB server...');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`[Setup] Connected to Mongo: ${uri}`);

    server = http.createServer(app);
    const io = new SocketIOServer(server, { cors: { origin: '*' } });
    io.use(socketAuthMiddleware);
    setIO(io);
    registerSocketHandlers(io);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        console.log(`[Setup] Test server listening on ${baseUrl}\n`);
        resolve();
      });
    });

    // ==============================================================
    // TEST 1: CREATE USER A, USER B, USER C (SIGNUP + EMAIL OTP)
    // ==============================================================
    console.log('--- TEST 1: User Signup & MongoDB Email OTP Verification ---');
    for (const u of [userA, userB, userC]) {
      // 1. Signup
      const signupRes = await request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: u.name,
          email: u.email,
          password: u.password,
          confirmPassword: u.password
        })
      });
      assert(signupRes.status === 201, `User ${u.name} signup returns 201 Created`);

      // 2. Query OTP stored in MongoDB
      const otpRecord = await Otp.findOne({ email: u.email, purpose: 'email_verification' });
      assert(otpRecord !== null, `OTP record successfully stored in MongoDB for ${u.email}`);
      assert(otpRecord.otp.length === 6, `Stored OTP is 6 digits: ${otpRecord.otp}`);

      // 3. Verify Email with OTP
      const verifyRes = await request('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: u.email, otp: otpRecord.otp })
      });
      assert(verifyRes.status === 200, `Email verification returns 200 OK for ${u.name}`);
      assert(verifyRes.data.user.isEmailVerified === true, `User isEmailVerified updated to true in MongoDB`);

      // 4. Login
      const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: u.email, password: u.password })
      });
      assert(loginRes.status === 200, `Login returns 200 OK for ${u.name}`);
      assert(Boolean(loginRes.data.token), `JWT issued for ${u.name}`);

      u.token = loginRes.data.token;
      u.id = loginRes.data.user._id;

      // 5. Connect Socket.IO client with JWT auth
      u.socket = ClientIO(baseUrl, {
        auth: { token: u.token },
        transports: ['websocket']
      });

      await new Promise((resolve) => u.socket.on('connect', resolve));
      assert(u.socket.connected, `Socket.IO connected and authenticated for ${u.name}`);
    }

    // ==============================================================
    // TEST 2: A SEARCHES B, STARTS PRIVATE CONV (VERIFY NO DUPLICATES)
    // ==============================================================
    console.log('\n--- TEST 2: User Search & Unique Private Conversation Creation ---');
    const searchRes = await request('/api/users/search?q=Bob', {}, userA.token);
    assert(searchRes.status === 200, 'User search returns 200 OK');
    assert(searchRes.data.users.some((u) => u.email === userB.email), 'User A finds Bob in search results');

    // A starts chat with B
    const convRes1 = await request('/api/conversations/private', {
      method: 'POST',
      body: JSON.stringify({ recipientId: userB.id })
    }, userA.token);
    assert(convRes1.status === 200, 'Conversation started between A and B');
    privateConvId = convRes1.data.conversation._id;

    // A starts chat with B a second time
    const convRes2 = await request('/api/conversations/private', {
      method: 'POST',
      body: JSON.stringify({ recipientId: userB.id })
    }, userA.token);
    assert(convRes2.status === 200, 'Second conversation call returns existing conversation');
    assert(convRes2.data.conversation._id === privateConvId, 'Identical conversation ID returned (No duplicate)');

    const totalConversations = await Conversation.countDocuments();
    assert(totalConversations === 1, `Exactly 1 conversation exists in MongoDB (found ${totalConversations})`);

    // A and B join private socket room
    await new Promise((resolve) => userA.socket.emit('join_private_conversation', { conversationId: privateConvId }, resolve));
    await new Promise((resolve) => userB.socket.emit('join_private_conversation', { conversationId: privateConvId }, resolve));

    // ==============================================================
    // TEST 3: A SENDS TEXT -> B RECEIVES INSTANTLY
    // ==============================================================
    console.log('\n--- TEST 3: A Sends Text -> B Receives Instantly via Socket.IO ---');
    const msgPromiseB = new Promise((resolve) => {
      userB.socket.once('private_message', (msg) => resolve(msg));
    });

    const sendResA = await request(`/api/conversations/${privateConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ type: 'text', content: 'Hello Bob! This is Alice.' })
    }, userA.token);

    assert(sendResA.status === 201, 'Message saved and returned 201 Created');
    testMessageId = sendResA.data.message._id;

    const receivedByB = await msgPromiseB;
    assert(receivedByB.content === 'Hello Bob! This is Alice.', 'B received message instantly with correct content');
    assert(receivedByB._id === testMessageId, 'Message ID matches between REST and Socket.IO');

    // ==============================================================
    // TEST 4: B REPLIES -> A RECEIVES INSTANTLY
    // ==============================================================
    console.log('\n--- TEST 4: B Replies -> A Receives Instantly ---');
    const msgPromiseA = new Promise((resolve) => {
      userA.socket.once('private_message', (msg) => resolve(msg));
    });

    const sendResB = await request(`/api/conversations/${privateConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        content: 'Hi Alice! Great to hear from you.',
        replyTo: testMessageId
      })
    }, userB.token);

    assert(sendResB.status === 201, 'Reply message saved and returned 201 Created');
    const receivedReplyByA = await msgPromiseA;
    assert(receivedReplyByA.content === 'Hi Alice! Great to hear from you.', 'A received reply instantly');
    assert(receivedReplyByA.replyTo && receivedReplyByA.replyTo._id === testMessageId, 'Reply properly references original message');

    // ==============================================================
    // TEST 5: REFRESH (VERIFY PERSISTENCE IN MONGODB)
    // ==============================================================
    console.log('\n--- TEST 5: Refresh & MongoDB Source of Truth Check ---');
    const getMsgsRes = await request(`/api/conversations/${privateConvId}/messages`, {}, userA.token);
    assert(getMsgsRes.status === 200, 'Messages loaded from DB after simulated refresh');
    assert(getMsgsRes.data.messages.length === 2, `Retrieved exactly 2 persisted messages (found ${getMsgsRes.data.messages.length})`);

    // ==============================================================
    // TEST 6: C ATTEMPTS A/B CONVERSATION (MUST FAIL 403)
    // ==============================================================
    console.log('\n--- TEST 6: C Attempts Accessing A/B Conversation (Must Fail 403) ---');
    const unauthorizedAccessRes = await request(`/api/conversations/${privateConvId}/messages`, {}, userC.token);
    assert(unauthorizedAccessRes.status === 403, 'C rejected with 403 Forbidden when accessing A/B messages');

    // ==============================================================
    // TEST 7: C ATTEMPTS A/B SOCKET ROOM (MUST FAIL)
    // ==============================================================
    console.log('\n--- TEST 7: C Attempts Joining A/B Socket Room (Must Fail) ---');
    const socketJoinResult = await new Promise((resolve) => {
      userC.socket.emit('join_private_conversation', { conversationId: privateConvId }, (ack) => {
        resolve(ack);
      });
    });
    assert(socketJoinResult.success === false, 'C rejected from joining private room');
    assert(socketJoinResult.error.includes('Unauthorized'), 'Error message confirms unauthorized rejection');

    // ==============================================================
    // TEST 8: A TYPES -> B SEES TYPING -> C DOES NOT
    // ==============================================================
    console.log('\n--- TEST 8: Real-Time Typing Indicator Isolation ---');
    let cReceivedTyping = false;
    userC.socket.on('private_typing_start', () => { cReceivedTyping = true; });

    const typingPromiseB = new Promise((resolve) => {
      userB.socket.once('private_typing_start', (data) => resolve(data));
    });

    userA.socket.emit('private_typing_start', { conversationId: privateConvId });
    const typingDataB = await typingPromiseB;
    assert(typingDataB.conversationId === privateConvId, 'B receives typing event');
    assert(typingDataB.userName === userA.name, 'B sees typing user name');
    assert(cReceivedTyping === false, 'C did not receive private typing event');

    // ==============================================================
    // TEST 9: B SEES MESSAGE -> A GETS SEEN STATUS (✓✓)
    // ==============================================================
    console.log('\n--- TEST 9: Read Receipts & Seen Status ---');
    const seenPromiseA = new Promise((resolve) => {
      userA.socket.once('messages_seen', (data) => resolve(data));
    });

    const markSeenRes = await request(`/api/conversations/${privateConvId}/read`, { method: 'POST' }, userB.token);
    assert(markSeenRes.status === 200, 'Mark seen API returns 200 OK');

    const seenEvent = await seenPromiseA;
    assert(seenEvent.conversationId === privateConvId, 'A receives real-time messages_seen event');
    const receiptInDB = await MessageReceipt.findOne({ messageId: testMessageId, userId: userB.id });
    assert(receiptInDB.status === 'seen', 'MessageReceipt updated to seen in MongoDB');

    // ==============================================================
    // TEST 10 & 11: UNREAD COUNTS PERSISTENCE & RESET
    // ==============================================================
    console.log('\n--- TEST 10 & 11: Unread Counts Survival & Reset ---');
    // A sends another message
    await request(`/api/conversations/${privateConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ type: 'text', content: 'Unread test message' })
    }, userA.token);

    // Check B's conversations list
    const convListResB = await request('/api/conversations/private', {}, userB.token);
    const convB = convListResB.data.conversations.find((c) => c._id === privateConvId);
    assert(convB.unreadCount === 1, `B unread count increased to 1 (found ${convB.unreadCount})`);

    // B opens conversation (marks read)
    await request(`/api/conversations/${privateConvId}/read`, { method: 'POST' }, userB.token);
    const convListAfterRead = await request('/api/conversations/private', {}, userB.token);
    const convAfter = convListAfterRead.data.conversations.find((c) => c._id === privateConvId);
    assert(convAfter.unreadCount === 0, 'B unread count reset to 0');

    // ==============================================================
    // TEST 12 & 13: EMOJI REACTIONS (ADD & REMOVE)
    // ==============================================================
    console.log('\n--- TEST 12 & 13: Real-Time Emoji Reactions ---');
    const reactionAddPromise = new Promise((resolve) => {
      userB.socket.once('reaction_updated', (data) => resolve(data));
    });

    const reactRes1 = await request(`/api/messages/${testMessageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji: '❤️' })
    }, userA.token);
    assert(reactRes1.status === 200 && reactRes1.data.action === 'added', 'A reacted with ❤️');

    const reactionEvent1 = await reactionAddPromise;
    assert(reactionEvent1.emoji === '❤️' && reactionEvent1.action === 'added', 'B receives real-time reaction added event');

    // Toggle reaction off
    const reactionRemovePromise = new Promise((resolve) => {
      userB.socket.once('reaction_updated', (data) => resolve(data));
    });

    const reactRes2 = await request(`/api/messages/${testMessageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji: '❤️' })
    }, userA.token);
    assert(reactRes2.status === 200 && reactRes2.data.action === 'removed', 'A removed reaction by clicking again');

    const reactionEvent2 = await reactionRemovePromise;
    assert(reactionEvent2.emoji === '❤️' && reactionEvent2.action === 'removed', 'B receives real-time reaction removed event');

    // ==============================================================
    // TEST 14: MESSAGE EDIT
    // ==============================================================
    console.log('\n--- TEST 14: Message Edit ---');
    const editPromise = new Promise((resolve) => {
      userB.socket.once('message_edited', (data) => resolve(data));
    });

    const editRes = await request(`/api/messages/${testMessageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Hello Bob! This message was edited by Alice.' })
    }, userA.token);
    assert(editRes.status === 200, 'Edit API returns 200 OK');

    const editEvent = await editPromise;
    assert(editEvent.content === 'Hello Bob! This message was edited by Alice.', 'B receives edited message content');
    assert(editEvent.edited === true, 'B receives edited: true status');

    // ==============================================================
    // TEST 15: MESSAGE DELETE (SOFT DELETE)
    // ==============================================================
    console.log('\n--- TEST 15: Message Soft Delete ---');
    const deletePromise = new Promise((resolve) => {
      userB.socket.once('message_deleted', (data) => resolve(data));
    });

    const delRes = await request(`/api/messages/${testMessageId}`, { method: 'DELETE' }, userA.token);
    assert(delRes.status === 200, 'Delete API returns 200 OK');

    const delEvent = await deletePromise;
    assert(delEvent.deleted === true, 'B receives deleted: true');
    assert(delEvent.content === 'This message was deleted', 'Content updated to deleted placeholder');

    // ==============================================================
    // TEST 16: IMAGE MESSAGE & MONGODB GRIDFS STREAMING
    // ==============================================================
    console.log('\n--- TEST 16: Image Upload to MongoDB GridFS & Binary Streaming ---');
    const fakeImageBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
    const gridFSImage = await uploadBufferToGridFS({
      buffer: fakeImageBuffer,
      filename: 'sample-photo.png',
      contentType: 'image/png',
      metadata: { uploaderId: userA.id }
    });
    imageMediaId = gridFSImage._id;
    assert(Boolean(imageMediaId), 'Image binary successfully stored in MongoDB GridFS');

    // A sends image message
    const sendImgRes = await request(`/api/conversations/${privateConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'image',
        mediaId: imageMediaId,
        fileName: 'sample-photo.png',
        mimeType: 'image/png',
        fileSize: fakeImageBuffer.length
      })
    }, userA.token);
    assert(sendImgRes.status === 201, 'Image message created in conversation');

    // B requests image binary: GET /media/:fileId
    const streamImgRes = await request(`/media/${imageMediaId}`, {}, userB.token);
    assert(streamImgRes.status === 200, 'GET /media/:fileId returns 200 OK');
    assert(streamImgRes.headers.get('content-type') === 'image/png', `Content-Type is image/png (actual binary)`);
    assert(streamImgRes.buffer.length === fakeImageBuffer.length, 'Streamed binary byte length exactly matches uploaded image');

    // ==============================================================
    // TEST 17: VOICE MESSAGE & GRIDFS AUDIO STREAMING
    // ==============================================================
    console.log('\n--- TEST 17: Voice Message Audio Stream & Persistence ---');
    const fakeAudioBuffer = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00');
    const gridFSAudio = await uploadBufferToGridFS({
      buffer: fakeAudioBuffer,
      filename: 'voice-note.webm',
      contentType: 'audio/webm',
      metadata: { uploaderId: userA.id }
    });
    voiceMediaId = gridFSAudio._id;

    await request(`/api/conversations/${privateConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'voice',
        mediaId: voiceMediaId,
        duration: 5,
        mimeType: 'audio/webm',
        fileSize: fakeAudioBuffer.length
      })
    }, userA.token);

    const streamAudioRes = await request(`/media/${voiceMediaId}`, {}, userB.token);
    assert(streamAudioRes.status === 200, 'GET /media/:fileId returns 200 OK for voice audio');
    assert(streamAudioRes.headers.get('content-type') === 'audio/webm', 'Content-Type is audio/webm (playable stream)');

    // ==============================================================
    // TEST 18: FILE ATTACHMENTS (PDF/TXT)
    // ==============================================================
    console.log('\n--- TEST 18: File Attachments in GridFS ---');
    const fakePdfBuffer = Buffer.from('%PDF-1.4 test document content');
    const gridFSPdf = await uploadBufferToGridFS({
      buffer: fakePdfBuffer,
      filename: 'contract.pdf',
      contentType: 'application/pdf',
      metadata: { uploaderId: userA.id }
    });
    fileMediaId = gridFSPdf._id;

    await request(`/api/conversations/${privateConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'file',
        mediaId: fileMediaId,
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSize: fakePdfBuffer.length
      })
    }, userA.token);

    const streamFileRes = await request(`/media/${fileMediaId}`, {}, userB.token);
    assert(streamFileRes.status === 200, 'Document downloaded with 200 OK');
    assert(streamFileRes.headers.get('content-type') === 'application/pdf', 'MIME type is application/pdf');

    // ==============================================================
    // TEST 19: GROUP CHAT (A + B + C)
    // ==============================================================
    console.log('\n--- TEST 19: Group Chat Creation & Real-Time Delivery ---');
    const createGroupRes = await request('/api/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Project Alpha Team',
        description: 'Team collaboration group',
        members: [userB.id, userC.id]
      })
    }, userA.token);
    assert(createGroupRes.status === 201, 'Group created by User A');
    groupId = createGroupRes.data.group._id;

    // A, B, and C join group socket room
    await new Promise((resolve) => userA.socket.emit('join_group', { groupId }, resolve));
    await new Promise((resolve) => userB.socket.emit('join_group', { groupId }, resolve));
    await new Promise((resolve) => userC.socket.emit('join_group', { groupId }, resolve));

    const groupMsgPromiseB = new Promise((resolve) => userB.socket.once('group_message', (msg) => resolve(msg)));
    const groupMsgPromiseC = new Promise((resolve) => userC.socket.once('group_message', (msg) => resolve(msg)));

    await request(`/api/conversations/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ type: 'text', content: 'Welcome to Project Alpha everyone!' })
    }, userA.token);

    const groupMsgB = await groupMsgPromiseB;
    const groupMsgC = await groupMsgPromiseC;
    assert(groupMsgB.content === 'Welcome to Project Alpha everyone!', 'Member B received group message');
    assert(groupMsgC.content === 'Welcome to Project Alpha everyone!', 'Member C received group message');

    // ==============================================================
    // TEST 20 & 21: ISOLATION BETWEEN PRIVATE & GROUP CHATS
    // ==============================================================
    console.log('\n--- TEST 20 & 21: Private vs Group Message Isolation ---');
    // Group messages shouldn't be in private chat
    const privateMsgsCheck = await request(`/api/conversations/${privateConvId}/messages`, {}, userA.token);
    assert(!privateMsgsCheck.data.messages.some((m) => m.content === 'Welcome to Project Alpha everyone!'),
      'Group message does NOT appear in private conversation');

    // Private messages shouldn't be in group chat
    const groupMsgsCheck = await request(`/api/conversations/${groupId}/messages`, {}, userA.token);
    assert(!groupMsgsCheck.data.messages.some((m) => m.content === 'Hello Bob! This is Alice.'),
      'Private message does NOT appear in group chat');

    // ==============================================================
    // TEST 22 & 23: C TRIES EDITING OR DELETING A's MESSAGE (FAILS)
    // ==============================================================
    console.log('\n--- TEST 22 & 23: Security: Unauthorized Edit and Delete Prevention ---');
    const unauthorizedEdit = await request(`/api/messages/${testMessageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Hacked by C' })
    }, userC.token);
    assert(unauthorizedEdit.status === 403, 'C cannot edit A\'s message (403 Forbidden)');

    const unauthorizedDelete = await request(`/api/messages/${testMessageId}`, {
      method: 'DELETE'
    }, userC.token);
    assert(unauthorizedDelete.status === 403, 'C cannot delete A\'s message (403 Forbidden)');

    // ==============================================================
    // TEST 24: LOGOUT & UNAUTHENTICATED PROTECTION
    // ==============================================================
    console.log('\n--- TEST 24: Logout & API Route Protection ---');
    userA.socket.disconnect();
    assert(!userA.socket.connected, 'User A socket successfully disconnected on logout');

    const unauthProtectedRes = await request('/api/auth/me', {});
    assert(unauthProtectedRes.status === 401, 'Unauthenticated request rejected with 401');

    console.log('\n=============================================================');
    console.log('🎉 ALL 24 TESTS PASSED SUCCESSFULLY WITH 100% SUCCESS!');
    console.log('=============================================================\n');

  } catch (error) {
    console.error('\n❌ Test suite encountered a failure:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (userA.socket) userA.socket.disconnect();
    if (userB.socket) userB.socket.disconnect();
    if (userC.socket) userC.socket.disconnect();

    if (server) server.close();
    if (mongoose.connection) await mongoose.connection.close();
    if (mongod) await mongod.stop();
  }
}

runAllTests();
