# High Severity Defect Email Alert System

## Overview
This system automatically sends email notifications to authorized users whenever a high-severity defect is detected in the database, whether added through your API or by external systems.

## Architecture

### Components
1. **Email Service** (`services/emailService.js`): Handles email sending via nodemailer
2. **Defect Watcher** (`services/defectWatcher.js`): Monitors database for new high-severity defects
3. **Notification Helper** (`helpers/defectNotification.js`): Manages recipient retrieval based on roles

### Detection Methods
- **Primary**: MongoDB Change Streams (real-time, no database polling)
- **Fallback**: Polling mechanism (checks every 30 seconds if Change Streams unavail)

## Setup Instructions

### 1. Environment Configuration

Create or update `.env` file in the `backend/` directory with:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/drone-navigation

# Other settings
PORT=5000
JWT_SECRET=your-jwt-secret
```

### 2. Gmail Setup (Recommended)

If using Gmail as email service:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Generate an "App Password" (not your regular Gmail password)
4. Use that app password in `EMAIL_PASSWORD`

**Why?** Gmail blocks regular password authentication for security reasons. App passwords are safer.

### 3. Install Dependencies

Already installed, but verify:
```bash
npm install
```

Should include:
- `nodemailer` - Email sending
- `node-cron` - Scheduled polling fallback
- `mongoose` - MongoDB driver

### 4. Verify User Roles

The system sends emails to users with these types:
- `admin` / `Admin`
- `manager` / `Manager`
- Users with role `can_view_defects` or `can_manage_defects`

Update your users accordingly:
```javascript
// Example user with admin access
{
  name: "John Inspector",
  email: "john@example.com",
  type: "admin"  // or "manager"
}
```

### 5. Start the Server

```bash
npm start      # Production
npm run dev    # Development with nodemon
```

On startup, you'll see:
```
✅ Email service is ready to send messages
🚀 Initializing defect monitoring...
✅ Defect watcher started successfully
```

## How It Works

### When Defect is Added via Your API

```
POST /api/defects
  ↓
Defect created in DB
  ↓
Check severity
  ↓
If "High" or "Critical" → Get eligible users
  ↓
Send email asynchronously
  ↓
Mark notificationSent = true
  ↓
Return API response (no wait)
```

### When Defect is Added by External System

**Change Stream watches for insertions:**
```
External System inserts into DB
  ↓
MongoDB Change Stream detects insert
  ↓
Checks if severity = "High"/"Critical"
  ↓
Fetches eligible users
  ↓
Sends email alert
```

**Fallback polling (if Change Streams unavailable):**
- Checks every 30 seconds for new high-severity defects
- Marks as `notificationSent` to avoid duplicate emails
- Only sends if `notificationSent` !== true

## Email Content

Recipients receive:
- ✅ Defect title, type, and crack type
- ✅ Severity level badge
- ✅ Detailed description
- ✅ Confidence level
- ✅ Location coordinates (lat/lng)
- ✅ Drone ID
- ✅ Detection timestamp
- ✅ Current status
- ✅ Defect image (if available)
- ✅ Direct link to dashboard

## Testing

### Test Email Service
Add this to `backend/src/index.js`:
```javascript
import { sendHighSeverityAlert } from './services/emailService.js';

// After server starts, test send:
const testDefect = {
  title: "Test Crack",
  description: "Test crack for email",
  severity: "Critical",
  defect_type: "crack",
  confidence: 95,
  location: { lat: 0, Lng: 0 },
  detected_time: new Date()
};

const testUsers = [{ email: "admin@example.com", name: "Admin" }];
await sendHighSeverityAlert(testDefect, testUsers);
```

### Manual Test Insert
Use MongoDB Compass or CLI:
```javascript
db.defects.insertOne({
  title: "Urgent Test Defect",
  severity: "Critical",
  description: "This should trigger an email",
  defect_type: "pothole",
  crack_type: "pothole",
  confidence: 98,
  location: { lat: 34.0522, Lng: -118.2437 },
  detected_time: new Date(),
  status: "open",
  notificationSent: false
})
```

Check your email within seconds (Change Stream) or 30 seconds (polling).

## Troubleshooting

### Email not sending?

1. **Check credentials**
   ```bash
   # Test connection manually
   node -e "require('nodemailer').createTransport({ service: 'gmail', auth: { user: 'email@gmail.com', pass: 'password' } }).verify((err, valid) => console.log(valid ? 'OK' : err))"
   ```

2. **Check logs**
   ```
   ❌ Error sending high severity alert email: [error message]
   ```

3. **Verify .env file**
   - Ensure `EMAIL_USER` and `EMAIL_PASSWORD` are set
   - Restart server after changing .env

### Change Streams not working?

- Requires **MongoDB 3.6+**
- Must be replica set or sharded cluster (local MongoDB won't work)
- Falls back to polling automatically

### Notifications not sent for external system inserts?

1. Verify defect has `severity: "High"` or `severity: "Critical"` (case-sensitive)
2. Check user types in database (must be 'admin' or 'manager')
3. Check server logs for errors
4. If using local MongoDB without replica set, polling fallback will activate

## Database Schema Update

The `notificationSent` field has been added to defectsModel:
- Type: Boolean
- Default: false
- Used to track email notifications and prevent duplicates

Existing defects without this field will have it auto-populated when accessed.

## Performance Notes

- **Change Streams**: Immediate notification (< 1 second)
- **Polling**: 30-second max delay (configurable in `defectWatcher.js`)
- **Email sending**: Asynchronous (doesn't block API responses)
- **Database load**: Minimal (only watches High/Critical inserts)

## Security Considerations

✅ App passwords for Gmail (not full password)
✅ Email addresses not exposed in logs (only count)
✅ Asynchronous email sending (doesn't block requests)
✅ Role-based access control for notifications
✅ Error handling doesn't expose sensitive info

## Customization

### Change Recipient Criteria
Edit `backend/src/helpers/defectNotification.js`:
```javascript
// Add more roles or conditions
const users = await User.find({
  $or: [
    { type: 'admin' },
    { department: 'Quality' },  // Add custom field
    { notificationPrefs: { enabled: true } }  // Add preferences
  ]
});
```

### Adjust Polling Interval
Edit `backend/src/services/defectWatcher.js` (line ~60):
```javascript
}, 30000); // Change 30000ms to desired interval
```

### Change Email Template
Edit HTML in `backend/src/services/emailService.js` (htmlContent variable)

### Add Additional Triggers
Update `backend/src/routers/defectRouter.js` POST route:
```javascript
// Trigger on Medium severity too
if (['High', 'Medium', 'Critical'].includes(defect.severity)) {
  // Send notification
}
```

## File Structure
```
backend/
├── src/
│   ├── services/
│   │   ├── emailService.js        # Email sending logic
│   │   └── defectWatcher.js       # Change Stream & polling
│   ├── helpers/
│   │   └── defectNotification.js  # User retrieval
│   ├── models/
│   │   ├── defectsModel.js        # Updated with notificationSent
│   │   └── userModel.js
│   ├── routers/
│   │   ├── defectRouter.js        # Updated POST route
│   │   └── authRouter.js
│   ├── config/
│   │   └── db.js
│   └── index.js                   # Updated startup
├── .env                           # Environment variables (git-ignored)
├── .env.example                   # Template for .env
└── package.json
```

## Next Steps

1. ✅ Set up `.env` with email credentials
2. ✅ Test email connection
3. ✅ Verify user roles in database
4. ✅ Start server and monitor logs
5. ✅ Test by adding a high-severity defect
6. ✅ Verify email received within seconds

---

**Questions?** Check server console logs - they're very detailed for debugging.
