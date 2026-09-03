# Chat Payment System Implementation Guide

## Overview
Implemented a time-based chat payment system where customers pay ₹10 per minute for messaging access. The system tracks conversation open/close times and enforces payment before allowing message sending.

## Backend Changes

### 1. Database Model Updates (`Backend/src/models/chat/Conversation.js`)

Added fields to track chat payment and sessions:
```javascript
{
  activeUntil: Date,           // Expiry timestamp for paid chat time
  totalPaidMinutes: Number,    // Cumulative minutes purchased
  sessionHistory: [{           // Track when conversation is opened/closed
    openedAt: Date,
    closedAt: Date
  }],
  currentSessionStart: Date    // Active session tracking
}
```

Added instance methods:
- `hasActiveChatTime()` - Check if customer has valid paid time
- `getRemainingSeconds()` - Get seconds remaining (0 if expired)
- `addChatTime(minutes)` - Add purchased minutes
- `startSession()` - Record conversation open time
- `endSession()` - Record conversation close time

### 2. API Endpoints (`Backend/src/controllers/chat.controller.js`)

**POST `/api/chat/conversations/:id/purchase-time`** (Customer only)
- Body: `{ minutes: number }` (1-60)
- Validates wallet balance (₹10 per minute)
- Deducts from wallet, adds time to conversation
- Creates transaction record with type "chat"
- Returns new activeUntil, remaining seconds, wallet balance

**GET `/api/chat/conversations/:id/access`** (Customer or Partner)
- Returns: hasAccess, remainingSeconds, activeUntil, totalPaidMinutes, pricing
- Partners always get hasAccess=true (they can send freely)
- Customers only have access if activeUntil > now

**POST `/api/chat/conversations/:id/start-session`** (Customer only)
- Called when customer opens conversation screen
- Records session start time in sessionHistory

**POST `/api/chat/conversations/:id/end-session`** (Customer only)
- Called when customer closes conversation screen
- Records session end time in sessionHistory

### 3. Message Validation

**Socket (`Backend/src/socket/chat.socket.js`)**
- Added validation in `send_message` event
- Customers must have `hasActiveChatTime()` to send
- Returns error: `{ error: "...", chatTimeExpired: true, remainingSeconds: 0 }`
- Partners can send freely without restriction

**REST API (`Backend/src/controllers/chat.controller.js`)**
- Added validation in `sendMessage` controller
- Same logic as socket: customers need active time, partners don't
- Returns 403 with chatTimeExpired flag when time runs out

### 4. Transaction Type
Updated `customer.wallet.js` model to include new transaction type:
- Type: `"chat"` (alongside topup, booking, refund, call, adjustment)
- Direction: `"debit"` (deducts from wallet)
- Description: "Chat time purchase: X minute(s) with [partnerId]"

## Frontend Changes (Customer App)

### 1. API Functions (`customerapp/src/api/chat.api.ts`)

Added new API calls:
```typescript
checkChatAccess(conversationId)      // Get current access status
purchaseChatTime(conversationId, minutes)  // Buy time
startChatSession(conversationId)     // Track session start
endChatSession(conversationId)       // Track session end
```

Types added:
- `ChatAccessResponse` - Access status, remaining time, pricing
- `PurchaseChatTimeResponse` - Purchase result, wallet balance

### 2. Purchase Modal (`customerapp/src/components/chat/PurchaseChatTimeModal.tsx`)

New modal component with features:
- Preset time options: 1, 5, 10, 30 minutes
- Shows current remaining time (if any)
- Displays wallet balance and total cost
- Calculates balance after purchase
- Disables unaffordable options
- Shows "Low balance" badges
- Handles purchase flow with loading states

### 3. Conversation Screen Updates (`customerapp/src/app/(tabs)/chat/[conversationId].tsx`)

**State Management:**
- `chatAccess` - Current access status from API
- `remainingSeconds` - Live countdown timer
- `walletBalance` - For purchase modal
- `purchaseModalVisible` - Show/hide purchase modal

**Timer Implementation:**
- Live countdown displayed in header
- Updates every second via setInterval
- Shows time in MM:SS format
- Color coded: green (active) / red (expired)
- Clickable to open purchase modal

**Session Tracking:**
- `startChatSession()` called on component mount
- `endChatSession()` called on unmount
- AppState listener tracks app background/foreground
- Ends session when app goes to background
- Refreshes access when app returns to foreground

**UI Changes:**
- **Header Timer Badge:**
  - Green background + time icon when active
  - Red background + lock icon when expired
  - Shows "Expired" text instead of timer

- **Input Bar:**
  - Normal text input + send button when active
  - Replaced with banner when expired:
    - Lock icon + "Chat time expired" message
    - "Purchase Time" button opens modal

**Message Sending:**
- Checks `canSendMessages` before sending
- Shows purchase modal if time expired
- Maintains existing phone number detection
- Shows error if socket returns chatTimeExpired

## User Flow

### Customer Flow:
1. Opens conversation with partner
2. System checks chat access (API call)
3. If no active time → shows expired UI immediately
4. Timer counts down in header
5. When time expires → input blocked, banner shown
6. Clicks "Purchase Time" → modal opens
7. Selects time amount (checks wallet balance)
8. Confirms purchase → wallet deducted, time added
9. Timer starts counting down from new time
10. Can send messages again

### Partner Flow:
- Partners can always send messages (no payment required)
- They don't see timer or purchase UI
- System validates but always allows their messages

## Pricing & Limits

- **Rate:** ₹10 per minute
- **Purchase Range:** 1-60 minutes per transaction
- **Payment Method:** Wallet balance only
- **No auto-renewal:** Manual purchase required when expired

## Session Tracking

Sessions record actual conversation screen open time:
```javascript
sessionHistory: [
  { openedAt: "2026-09-03T10:00:00Z", closedAt: "2026-09-03T10:05:30Z" },
  { openedAt: "2026-09-03T14:30:00Z", closedAt: null } // Currently active
]
```

This allows analytics on:
- Total time spent in conversation
- Number of sessions
- Average session duration
- Time utilization vs. paid minutes

## Edge Cases Handled

1. **App Background:** Session ends when app goes to background
2. **App Foreground:** Access refreshed when app returns
3. **Insufficient Balance:** Purchase button disabled, clear messaging
4. **Timer Expiry:** Automatic UI update, countdown stops
5. **Multiple Purchases:** Time extends from current activeUntil
6. **Partner Blocking:** Existing block logic takes precedence
7. **Network Errors:** Graceful error handling with retry options

## Testing Checklist

- [ ] Purchase 1 minute, verify wallet deduction
- [ ] Verify timer counts down correctly
- [ ] Test message blocking when expired
- [ ] Test purchase modal with insufficient balance
- [ ] Verify session tracking (start/end)
- [ ] Test app background/foreground transitions
- [ ] Verify partner can send without restrictions
- [ ] Test extending time before expiry
- [ ] Verify transaction history shows chat purchases
- [ ] Test socket error handling for chatTimeExpired

## Database Migration

No migration needed - new fields have defaults:
- `activeUntil: null` (no access)
- `totalPaidMinutes: 0`
- `sessionHistory: []`
- `currentSessionStart: null`

Existing conversations will require purchase before messaging.

## API Rate Limits

Consider adding rate limiting to prevent abuse:
- Purchase endpoint: Max 10 requests per minute per user
- Session tracking: Deduplicate rapid start/end calls

## Future Enhancements

1. **Auto-renewal:** Option to auto-purchase when time runs low
2. **Packages:** Bulk discounts (e.g., 100 mins for ₹900)
3. **Analytics Dashboard:** Show usage patterns to customers
4. **Notifications:** Push notification when 1 minute remaining
5. **Refund Policy:** Unused time refund on conversation close
6. **Partner Revenue Share:** Share revenue with partners per conversation
7. **Subscription Model:** Monthly unlimited messaging option
8. **Time Gifting:** Customer can gift time to another customer

## Files Modified

### Backend:
- `src/models/chat/Conversation.js` - Added payment fields & methods
- `src/controllers/chat.controller.js` - Added 4 new endpoints + validation
- `src/routes/chat.routes.js` - Added new routes
- `src/socket/chat.socket.js` - Added time validation in send_message

### Frontend:
- `src/api/chat.api.ts` - Added payment API functions
- `src/components/chat/PurchaseChatTimeModal.tsx` - New payment modal
- `src/app/(tabs)/chat/[conversationId].tsx` - Integrated timer & session tracking

## Support & Troubleshooting

**Timer not updating:**
- Check if timerIntervalRef is being cleared properly
- Verify remainingSeconds state updates
- Check AppState listener is active

**Session not ending on background:**
- Verify AppState subscription is set up
- Check API endpoint is being called
- Review endChatSession error logs

**Purchase failing:**
- Verify wallet balance is sufficient
- Check transaction creation succeeds
- Review customer wallet balance updates
- Confirm conversation.addChatTime() saves correctly

**Messages blocked incorrectly:**
- Verify hasActiveChatTime() logic
- Check activeUntil timestamp format
- Confirm server and client time sync
