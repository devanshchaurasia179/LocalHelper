# Call Charging System - ₹30 per Minute

## Overview
The platform now uses a unified per-minute billing model for all calls at **₹30 per minute** for both customers and partners.

## Key Changes

### 1. **Wallet-Based Charging**
- Both customers and partners are charged **₹30 per minute** from their wallet balance
- Charges are deducted **at the end of the call** based on actual call duration
- Duration is **rounded up** to the next full minute (e.g., 2:15 call = 3 minutes = ₹90)
- **Calls automatically end when either party's balance reaches ₹0**

### 2. **Default Wallet Balance**
- New customers start with **₹500** in their wallet
- New partners start with **₹500** in their wallet
- This allows immediate calling without requiring an initial top-up

### 3. **Call Flow**

#### Before Call Starts:
- Customer/Partner initiates call → System checks if **both parties** have wallet balance ≥ ₹30 (minimum for 1 minute)
- If either insufficient: Call rejected with error `INSUFFICIENT_BALANCE`
- If sufficient: Call proceeds, `allowedTime` calculated based on **minimum of both balances**

#### During Call:
- Timer runs based on `allowedTime` (calculated as: `Math.floor(min(customerBalance, partnerBalance) / 30) * 60` seconds)
- **Every 5 seconds**: System checks both wallet balances
- **If either balance reaches ₹0**: Call automatically ends immediately
- Warnings emitted at:
  - **2 minutes remaining** - "Your wallet will be charged ₹30/minute"
  - **1 minute remaining** - "Charges are ₹30 per minute"
  - **30 seconds remaining** - "30 seconds remaining!"
- When time exhausted: Call auto-ends, wallets charged

#### After Call Ends:
- Duration calculated in seconds
- Rounded up to next minute: `Math.ceil(duration / 60)`
- **Customer wallet**: Charged `minutes * ₹30` (clamped to available balance)
- **Partner wallet**: Charged `minutes * ₹30` (clamped to available balance)
- **Balance never goes below ₹0**
- Transaction records created with type `"call"` (customer) and `"call_charge"` (partner)

### 4. **Transaction Types**

#### Customer Transactions:
- Type: `"call"`
- Direction: `"debit"`
- Description: `"Call charges - X min @ ₹30/min"`

#### Partner Transactions:
- Type: `"call_charge"` (new type added)
- Direction: `"debit"`
- Description: `"Call charges - X min @ ₹30/min"`

### 5. **Removed Features**
- ❌ `callBalance` field (was in seconds) - No longer used
- ❌ Per-partner `callCharges` pricing - Replaced with flat ₹30/min
- ❌ Prepaid/postpaid dual models - Single unified model
- ❌ `/api/bookings/call/:partnerId` endpoint - Call initiation no longer requires booking

### 6. **Updated Models**

#### Customer Model (`customer.profile.js`):
```javascript
walletBalance: {
  type: Number,
  default: 500,  // No min constraint, can go negative
}
```

#### Partner Model (`partner.profile.js`):
```javascript
walletBalance: {
  type: Number,
  default: 500,  // Can go negative
}
```

#### Partner Transaction Model (`partner.transaction.js`):
```javascript
type: {
  enum: ["earning", "payout", "adjustment", "call_charge", "chat_charge"]
}
```

### 7. **API Changes**

#### Call Creation (`POST /api/calls/create`):
**Before:**
- Checked `callBalance` or partner's `callCharges`
- Complex prepaid/postpaid logic

**After:**
- Simple wallet balance check (≥ ₹30)
- Returns `allowedTime` based on wallet balance

#### Call End (`POST /api/calls/:callId/end`):
**Before:**
- Deducted from `callBalance` (seconds) for non-prepaid
- No charge for prepaid calls

**After:**
- Always charges both parties from wallet
- ₹30 per minute, rounded up
- Creates transaction records

### 8. **Balance Protection**
- Wallet balances **cannot go below ₹0**
- Call automatically ends when either party reaches ₹0
- Charges are clamped to available balance at call end
- System checks balances every 5 seconds during active calls
- New event: `call_balance_exhausted` emitted when balance reaches 0

## Migration Notes

### For Existing Data:
- Existing customers with `callBalance` can still use it (field not removed, just unused)
- Existing partners with `callCharges` settings - ignored, flat ₹30/min applies
- All new calls use the new system
- Old transaction records remain unchanged

### For Frontend:
- Update call UI to show "₹30/min" pricing
- Remove "recharge call balance" flows if present
- Show unified wallet balance
- Display per-minute charges in call history

## Testing Checklist
- [ ] Customer with ₹500 balance can make ~16 minute call
- [ ] Both wallets charged after call ends
- [ ] Call auto-ends when time exhausted
- [ ] Call auto-ends when either balance reaches ₹0
- [ ] Balance checks every 5 seconds during call
- [ ] Warnings display correctly
- [ ] Transaction records created correctly
- [ ] Balances never go negative
- [ ] Partner-initiated calls also check both balances
- [ ] Partner-initiated calls also have time limits based on balances
- [ ] Call duration rounds up correctly (2:01 = 3 minutes = ₹90)
- [ ] Both parties notified when balance exhausted
- [ ] Charges clamped to available balance (no overdraft)

## Future Enhancements
- Dynamic pricing based on time of day
- Subscription plans for unlimited calling
- Call packages (e.g., 100 minutes for ₹2500)
- Separate rates for customer vs partner
