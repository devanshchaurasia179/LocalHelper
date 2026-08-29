// Push Notification fields
const notificationFields = {
  // FCM device tokens — one entry per device the customer is logged in on.
  // Upserted by token so re-registering the same device doesn't create dupes.
  fcmTokens: [
    {
      token: {
        type: String,
        required: true,
      },
      platform: {
        type: String,
        enum: ["android", "ios"],
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
};

export default notificationFields;
