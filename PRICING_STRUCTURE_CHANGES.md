# Visiting Credits Pricing Structure Update

## Overview
Updated the visiting credits field from a simple number to a structured pricing model that supports multiple billing types: per visit, per hour, per day, or per week.

## Changes Made

### 1. Database Model (`Backend/src/models/partner/partner.service.js`)
**Before:**
```javascript
visitingCredits: Number,
```

**After:**
```javascript
visitingCredits: {
  type: {
    type: String,
    enum: ["perVisit", "perHour", "perDay", "perWeek"],
    default: "perVisit",
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
}
```

### 2. Backend Controller (`Backend/src/controllers/partner.service.controller.js`)

#### setupService()
- Updated to accept `visitingCreditsType` and `visitingCreditsAmount` instead of `visitingCredits`
- Added validation for pricing type (must be one of: perVisit, perHour, perDay, perWeek)
- Saves pricing data as a nested object with type and amount

**Request body example:**
```javascript
{
  visitingCreditsType: "perHour",
  visitingCreditsAmount: 300,
  // ... other fields
}
```

#### updateVisitingCredits()
- Updated endpoint to accept both type and amount
- Validates pricing type enum

**Request body example:**
```javascript
{
  visitingCreditsType: "perVisit",
  visitingCreditsAmount: 150
}
```

### 3. Frontend OnboardingContext (`Partner/partnerapp/src/contexts/OnboardingContext.tsx`)

**Before:**
```typescript
visitingCredits: string;
```

**After:**
```typescript
visitingCreditsType: "perVisit" | "perHour" | "perDay" | "perWeek";
visitingCreditsAmount: string;
```

### 4. Frontend Form (`Partner/partnerapp/src/app/(onboarding)/add-service.tsx`)

#### UI Changes
- Added pricing model selector with 4 chip buttons: "Per Visit", "Per Hour", "Per Day", "Per Week"
- Separated pricing type selection from amount input
- Dynamic hint text shows what each pricing model means
- Amount input accepts numbers only

#### State Management
- Split single `visitingCredits` state into `visitingCreditsType` and `visitingCreditsAmount`
- Updated form submission to send both fields separately
- Updated form prefill logic to parse the nested object from server

#### Validation
- Amount must be a positive number
- Type must be selected (defaults to "perVisit")
- Both fields required before form submission

#### New Styles Added
```typescript
pricingTypeGrid: Radio button grid layout
pricingTypeChip: Individual pricing model button
pricingTypeChipActive: Selected state styling
pricingTypeText: Button text styling
```

## API Changes

### PUT /api/partner/service/setup
**Request body** (changed):
```javascript
{
  categories: ["catId1", "catId2"],
  experience: 5,
  languages: ["Hindi", "English"],
  bio: "Description",
  visitingCreditsType: "perHour",    // NEW
  visitingCreditsAmount: 300,         // NEW (was: visitingCredits: 300)
  emergencyAvailable: true,
  workingDays: [...]
}
```

### PATCH /api/partner/service/visiting-credits
**Request body** (changed):
```javascript
{
  visitingCreditsType: "perDay",    // NEW
  visitingCreditsAmount: 1500       // NEW (was: visitingCredits: 150)
}
```

## Database Response Format

The API will now return pricing data in this format:
```javascript
{
  visitingCredits: {
    type: "perHour",
    amount: 300
  }
}
```

## Files Modified
1. ✅ `Backend/src/models/partner/partner.service.js` - Schema
2. ✅ `Backend/src/controllers/partner.service.controller.js` - Controller logic
3. ✅ `Partner/partnerapp/src/contexts/OnboardingContext.tsx` - Context types and defaults
4. ✅ `Partner/partnerapp/src/app/(onboarding)/add-service.tsx` - Form UI and logic

## Files That May Need Updates (Not Done Yet)

These files reference `visitingCredits` and may need updates to handle the new nested structure:

- `Backend/src/routes/partner.service.routes.js` - No changes needed (routes pass through)
- `Backend/src/controllers/booking.controller.js` - Saves `visitingCredit: partner.visitingCredits` to bookings
- `Backend/src/models/customer/nearby.services.js` - Projects `visitingCredits` field
- `Partner/partnerapp/src/api/service.api.ts` - TypeScript types
- `Customer/customerapp/src/api/nearby.api.ts` - May need to handle nested structure
- `Customer/customerapp/src/app/(tabs)/home/PartnerDetailSheet.tsx` - Displays pricing
- `Customer/customerapp/src/app/(tabs)/nearby/PartnerCard.tsx` - Displays pricing in cards
- All other files that reference `visitingCredits`

## Example Database Entry

```javascript
{
  _id: ObjectId("..."),
  categories: [...],
  experience: 5,
  languages: ["Hindi", "English"],
  bio: "Experienced plumber",
  visitingCredits: {
    type: "perHour",
    amount: 300
  },
  emergencyAvailable: true,
  workingDays: [...]
}
```

## Next Steps

1. **Update API Types** - Update TypeScript interfaces in partner.api.ts and similar files
2. **Update Customer UI** - Modify customer-facing components to display the new pricing format
3. **Update Booking Model** - Decide how to store pricing in bookings (store just amount or both type and amount)
4. **Data Migration** - Write migration script if needed for existing partners with old pricing structure
5. **Testing** - Test onboarding flow end-to-end
6. **Update API Documentation** - Update any API docs or swagger specs

## Backward Compatibility Note

⚠️ **Breaking Change**: This is a breaking change. Existing code that sends or expects `visitingCredits: number` will fail.

If you have existing data, you may need to migrate it:
```javascript
db.partners.updateMany(
  { visitingCredits: { $type: "double" } },
  [{
    $set: {
      visitingCredits: {
        type: "perVisit",
        amount: "$visitingCredits"
      }
    }
  }]
)
```
