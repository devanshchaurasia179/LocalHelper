# 🧪 Chat Feature Testing Guide

## Quick Verification: Is Socket.IO Working?

### ✅ Method 1: Check Backend Console

Start your backend server and look for this output:
```bash
[Socket.IO] Initialised — /chat namespace ready
Server is running on port 5001
```

When an app connects, you'll see:
```bash
[Socket] connected  — partner:64abc123...  (socket-id-xyz)
```

### ✅ Method 2: Check App Console

In React Native development console (Metro bundler), you should see:
```bash
🔥 RUNTIME API URL: https://localhelperproxy.vercel.app/api
[ChatSocket] Base URL: http://localhelperbackend-env.eba-xsu7rune...
[ChatSocket] Connected: socket-id-xyz
```

### ✅ Method 3: Visual Indicator in App

Both Partner and Customer apps show a **live status indicator**:
- 🟢 **"Live"** with green dot = Socket connected ✅
- 🔴 **"Offline"** with gray dot = Socket disconnected ❌

Look for this in the top-right corner of the Chat screen.

---

## 🚀 End-to-End Testing Flow

### Test 1: Basic Connection

**Partner App:**
1. Open app and log in
2. Navigate to **Chat tab**
3. Check status indicator shows **"Live" (green dot)**
4. Check Metro console for connection log

**Customer App:**
1. Open app and log in
2. Navigate to **Chat tab**
3. Check status indicator shows **"Live" (green dot)**
4. Check Metro console for connection log

✅ **Expected:** Both apps connect successfully to Socket.IO

---

### Test 2: Send Message (Partner → Customer)

**Setup:**
- Partner and Customer both logged in
- Both have the Chat screen open
- Create a conversation (either from a booking or manually via API)

**Steps:**
1. **Partner:** Open a conversation with a customer
2. **Partner:** Type a message and hit send
3. **Customer:** Watch the conversation list

✅ **Expected:**
- Partner sees message appear instantly (optimistic UI)
- Customer receives message in real-time without refresh
- Conversation moves to top of list
- Unread badge appears for customer

---

### Test 3: Typing Indicators

**Steps:**
1. **Partner:** Open a chat with customer
2. **Customer:** Open the same chat
3. **Partner:** Start typing (don't send)
4. **Customer:** Watch below partner name

✅ **Expected:**
- Customer sees **"typing..."** in italics below partner's name
- Typing indicator disappears 2s after partner stops typing

---

### Test 4: Read Receipts

**Steps:**
1. **Partner:** Send a message to customer
2. **Customer:** Open the conversation

✅ **Expected:**
- Customer's unread badge clears immediately
- Partner sees the unread counter drop to 0
- Backend logs show `mark_read` event

---

### Test 5: Offline → Online Reconnection

**Steps:**
1. **Partner:** Open chat screen (status shows "Live")
2. **Partner:** Turn off Wi-Fi / mobile data
3. **Partner:** Status changes to "Offline"
4. **Partner:** Turn Wi-Fi back on
5. **Partner:** Status changes back to "Live" automatically

✅ **Expected:**
- Socket auto-reconnects within 1-2 seconds
- No messages lost
- Chat continues to work normally

---

### Test 6: Message Pagination

**Steps:**
1. Create a conversation with 50+ messages (use API or manually)
2. **Customer:** Open the chat
3. **Customer:** Scroll to the top

✅ **Expected:**
- Initial load shows last 30 messages
- Scrolling up loads older messages
- Loading spinner appears while fetching
- No duplicate messages

---

### Test 7: Optimistic UI with Failed Send

**Steps:**
1. **Partner:** Open a chat
2. **Partner:** Disconnect internet
3. **Partner:** Type and send a message
4. **Partner:** Watch the message bubble

✅ **Expected:**
- Message appears immediately with spinner (optimistic UI)
- After ~10s, spinner changes to red error icon
- Message stays in chat with visual error indicator

---

### Test 8: Multiple Conversations

**Steps:**
1. **Partner:** Have conversations with 3+ different customers
2. **Customer 1:** Send a message to partner
3. **Partner:** Check conversation list
4. **Customer 2:** Send a message to partner
5. **Partner:** Check conversation list again

✅ **Expected:**
- Conversation with Customer 1 moves to top
- Unread badge shows "1"
- Customer 2's message moves their conversation to top
- Unread badges accumulate correctly

---

## 🐛 Debugging Common Issues

### Issue 1: Socket status shows "Offline" or "Connecting..."

**Possible Causes:**
1. Backend server not running
2. Wrong socket URL in `.env`
3. JWT token endpoint failing
4. CORS blocking the connection
5. Network firewall blocking WebSocket

**Debug Steps:**

**Step A: Verify backend is reachable**
```bash
curl http://localhelperbackend-env.eba-xsu7rune.ap-south-1.elasticbeanstalk.com/api/health
```
Expected: `{"status":"ok"}`

**Step B: Check JWT endpoint**
```bash
# Login first to get cookie, then:
curl -X GET http://localhost:5001/api/chat/socket-token \
  -H "Cookie: partner_token=<your_token>" \
  --verbose
```
Expected: `{"token":"eyJhbGc...", "userType":"partner"}`

**Step C: Check app console**
Look for error messages like:
```
[ChatSocket] socket setup error: Error: Socket connection timed out
```

**Step D: Check `.env` files**

Partner App:
```bash
EXPO_PUBLIC_SOCKET_URL=http://localhelperbackend-env.eba-xsu7rune.ap-south-1.elasticbeanstalk.com
```

Customer App:
```bash
EXPO_PUBLIC_SOCKET_URL=http://localhelperbackend-env.eba-xsu7rune.ap-south-1.elasticbeanstalk.com
```

**Step E: Restart Metro bundler**
```bash
# Kill existing Metro process
# Then restart:
npm start -- --reset-cache
```

---

### Issue 2: Messages not appearing in real-time

**Possible Causes:**
1. Socket disconnected silently
2. Not joined to the conversation room
3. Event listeners not registered
4. ConversationId mismatch

**Debug Steps:**

**Step A: Check socket connection**
Look at the status indicator - should be green "Live"

**Step B: Check backend logs**
When you open a chat, backend should show:
```
[Socket] partner:64abc123... joined room conv:65def456...
```

**Step C: Check Metro console**
Should see socket event logs when messages arrive

**Step D: Manually emit test event**
In React Native Debugger console:
```javascript
const socket = getChatSocket();
socket.emit('send_message', {
  conversationId: 'your-conversation-id',
  text: 'Test message',
  tempId: 'test123'
});
```

---

### Issue 3: "AUTH_REQUIRED" or "AUTH_FAILED" error

**Possible Causes:**
1. JWT token expired
2. Cookie not being sent
3. Token format incorrect

**Debug Steps:**

**Step A: Check if user is logged in**
```javascript
// In app console
import { api } from '@/constants/api';
const res = await api.get('/partner/auth/me');
console.log(res.data);
```

**Step B: Manually get socket token**
```javascript
import { getSocketToken } from '@/api/chat.api';
const { data } = await getSocketToken();
console.log('Token:', data.token);
```

**Step C: Decode JWT**
Copy the token and paste it into https://jwt.io
Check:
- `id` field exists
- `userType` is "customer" or "partner"
- `exp` (expiry) is in the future

---

### Issue 4: Typing indicators not working

**Possible Causes:**
1. Socket not connected
2. Not in the same conversation room
3. Event names mismatched

**Debug Steps:**

**Step A: Check socket events in console**
Type in the input field and look for:
```
Socket emitting: typing_start
```

**Step B: Check backend received it**
Backend should log (if debug enabled):
```
[Socket] received typing_start from partner:64abc123...
```

**Step C: Manually emit typing event**
```javascript
const socket = getChatSocket();
socket.emit('typing_start', { conversationId: 'your-id' });
```

---

## 📊 Performance Benchmarks

### Expected Metrics:

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Socket connection time | < 1s | 1-3s | > 3s |
| Message delivery (local) | < 100ms | 100-500ms | > 500ms |
| Message delivery (3G) | < 500ms | 500ms-2s | > 2s |
| Typing indicator delay | < 200ms | 200-500ms | > 500ms |
| Reconnection time | < 2s | 2-5s | > 5s |
| Initial message load (30) | < 500ms | 500ms-1s | > 1s |
| Pagination load | < 300ms | 300-800ms | > 800ms |

---

## 🔍 Manual API Testing

### Using Postman/Thunder Client:

#### 1. Get Socket Token
```http
GET http://localhost:5001/api/chat/socket-token
Cookie: partner_token=<your_cookie_value>
```

#### 2. Get Conversations
```http
GET http://localhost:5001/api/chat/conversations
Cookie: partner_token=<your_cookie_value>
```

#### 3. Create Conversation
```http
POST http://localhost:5001/api/chat/conversations
Cookie: partner_token=<your_cookie_value>
Content-Type: application/json

{
  "customerId": "64abc123...",
  "bookingId": "optional-booking-id"
}
```

#### 4. Get Messages
```http
GET http://localhost:5001/api/chat/conversations/{conversationId}/messages?page=1&limit=30
Cookie: partner_token=<your_cookie_value>
```

#### 5. Send Message
```http
POST http://localhost:5001/api/chat/conversations/{conversationId}/messages
Cookie: partner_token=<your_cookie_value>
Content-Type: application/json

{
  "text": "Hello from API!"
}
```

---

## ✅ Final Verification Checklist

Before considering the feature complete, verify:

### Backend:
- [ ] Socket.IO server starts without errors
- [ ] `/chat/socket-token` endpoint returns valid JWT
- [ ] Conversation and Message models exist in DB
- [ ] CORS allows both apps to connect

### Partner App:
- [ ] `socket.io-client` installed
- [ ] Chat tab appears in navigation
- [ ] Socket connects (green "Live" indicator)
- [ ] Can see conversation list
- [ ] Can open individual chat
- [ ] Can send messages
- [ ] Receives messages in real-time
- [ ] Typing indicators work
- [ ] Unread badges update

### Customer App:
- [ ] `socket.io-client` installed
- [ ] Chat tab appears in navigation
- [ ] Socket connects (green "Live" indicator)
- [ ] Can see conversation list
- [ ] Can open individual chat
- [ ] Can send messages
- [ ] Receives messages in real-time
- [ ] Typing indicators work
- [ ] Unread badges update

### Integration:
- [ ] Partner sends → Customer receives (real-time)
- [ ] Customer sends → Partner receives (real-time)
- [ ] Typing indicators work bidirectionally
- [ ] Read receipts work
- [ ] Socket reconnects after network drop
- [ ] No duplicate messages
- [ ] Optimistic UI handles failures gracefully

---

## 🎉 Success Criteria

**The chat feature is working correctly when:**

1. ✅ Both apps show **"Live"** status with green dot
2. ✅ Messages send and appear on the other side **within 1 second**
3. ✅ Typing indicators appear **within 200ms** of typing
4. ✅ Unread badges update **in real-time**
5. ✅ Socket **auto-reconnects** after network interruption
6. ✅ No console errors related to socket or chat
7. ✅ Backend logs show successful connections and events

---

## 📞 Support

If you're still experiencing issues after following this guide:

1. Check `CHAT_IMPLEMENTATION_SUMMARY.md` for architecture details
2. Review backend logs for error messages
3. Check Metro bundler console for client-side errors
4. Ensure all dependencies are installed (`socket.io-client@4.8.1`)
5. Verify `.env` files have correct socket URLs
6. Test with a fresh build (clear cache and reinstall)

**Remember:** The Vercel proxy does NOT support WebSocket — socket must connect directly to AWS backend!
