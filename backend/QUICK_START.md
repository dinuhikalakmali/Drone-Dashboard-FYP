# 🚀 Quick Start - High Severity Defect Alerts

## What Was Implemented

✅ **Email Service** - Sends formatted HTML emails with defect details  
✅ **Database Watcher** - Real-time detection via MongoDB Change Streams  
✅ **Fallback Polling** - 30-second checks if Change Streams unavailable  
✅ **Role-Based Recipients** - Auto-sends to admins/managers only  
✅ **Async Processing** - Doesn't block API responses  
✅ **Duplicate Prevention** - Tracks sent notifications  

---

## Setup in 5 Minutes

### Step 1: Configure Email (.env file)

Create `backend/.env`:
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
MONGO_URI=mongodb://localhost:27017/drone-navigation
PORT=5000
```

**Gmail users?** 
1. Enable 2FA at: https://myaccount.google.com/security
2. Generate App Password (not your regular password)
3. Use that app password above

### Step 2: Ensure Users Have Correct Roles

In MongoDB, users must have:
- `type: "admin"` OR `type: "manager"` OR
- `roles: ["can_view_defects"]`

Example:
```javascript
db.users.updateOne(
  { email: "inspector@company.com" },
  { $set: { type: "admin" } }
)
```

### Step 3: Start Server

```bash
cd backend
npm start
```

Watch for:
```
✅ Email service is ready to send messages
🚀 Initializing defect monitoring...
✅ Defect watcher started successfully - listening for high severity defects
```

## Drone API Authentication

Drone submissions to `POST /api/inspections` and `POST /api/defects/drone` require an ID and a private token. The configured ID must match `drone_id` or `camera_id` in the request body.

Generate a unique token in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Add the ID and generated token to `backend/.env` as a JSON object. Replace the example token; never commit or share the real value:

```env
DRONE_CREDENTIALS={"DRONE001":"replace-with-the-64-character-token"}
```

Multiple drones can be configured as additional entries in the JSON object. Restart the backend after changing `.env`.

Send these headers with each drone request:

```text
x-drone-id: DRONE001
x-drone-token: <the configured token>
```

The body must include the same ID as `camera_id` (defects) or `drone_id` (inspections). Do not embed the token in browser/frontend code; it belongs on the drone client. Keep `POST /api/defects` for existing dashboard submissions.

---

## Testing

### Test 1: Add High-Severity Defect via API
```bash
curl -X POST http://localhost:5000/api/defects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Critical Pothole",
    "severity": "High",
    "description": "Test alert",
    "defect_type": "pothole",
    "confidence": 95
  }'
```

**Expected:** Email arrives within 2 seconds

### Test 2: Add via MongoDB (External System)
```javascript
db.defects.insertOne({
  title: "Test High Severity",
  severity: "Critical",
  description: "Should trigger alert",
  defect_type: "crack",
  confidence: 98,
  status: "open"
})
```

**Expected:** Email arrives within 2 seconds (Change Stream) or 30 seconds (polling)

---

## Files Created/Modified

### New Files
- `src/services/emailService.js` - Email sending
- `src/services/defectWatcher.js` - Database monitoring
- `src/helpers/defectNotification.js` - Recipient management
- `.env.example` - Configuration template
- `DEFECT_ALERT_SETUP.md` - Full documentation

### Modified Files
- `src/models/defectsModel.js` - Added `notificationSent` field
- `src/routers/defectRouter.js` - Email trigger on POST
- `src/index.js` - Start watcher on server boot
- `package.json` - Added node-cron

---

## How It Works

```
Defect inserted (API or External)
         ↓
    Is Severity "High"/"Critical"?
         ├─ NO  → Done
         └─ YES → Fetch eligible users
              ↓
         Send email to all admins/managers
              ↓
         Mark as notificationSent = true
              ↓
         Done (no blocking)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Email not sending | Check .env credentials, verify Gmail app password is correct |
| Users not receiving emails | Ensure `type: "admin"` or `type: "manager"` in database |
| Notifications delayed | Could be polling fallback (Change Streams unavailable) |
| Change Streams error | Requires MongoDB replica set/sharded cluster (not local dev) |
| Can't connect email | Test with: `npm install -g mailhog && mailhog` (local testing) |

---

## Email Preview

Recipients get an email with:
- 🚨 Severity badge
- 📋 Defect details (title, type, crack type)
- 📍 Location coordinates
- 🔍 Confidence level
- 🛣️ Drone ID
- 📸 Defect image (if attached)
- 🔗 Direct link to dashboard

---

## Production Checklist

- [ ] Email credentials configured
- [ ] User roles set to admin/manager in database
- [ ] Server started and watcher initialized
- [ ] Test defect created and email received
- [ ] Frontend URL points to correct dashboard
- [ ] Email service tested with `testEmailConnection()`
- [ ] MongoDB Change Streams supported (or polling fallback active)

---

## Need Help?

See full guide: [DEFECT_ALERT_SETUP.md](./DEFECT_ALERT_SETUP.md)

**Server logs show detailed info:**
```
✅ = Success
❌ = Error
⚠️ = Warning
🚨 = Alert triggered
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│  External System                        │
│  (inserts defects to MongoDB)           │
└────────────────┬────────────────────────┘
                 ↓
         ┌──────────────┐
         │   MongoDB    │ ← Change Stream watches here
         │   Defects    │   (Real-time)
         └──────────────┘
                 ↑ or ↑
         ┌───────────────────┐
         │   Your API        │ ← Also watches POST requests
         │   POST /defects   │   (Can trigger directly)
         └───────────────────┘
                 ↓
         ┌──────────────────────────┐
         │  Severity = High/Critical?│
         └───────────┬──────────────┘
                     ↓ YES
         ┌──────────────────────────┐
         │ Get Admin/Manager Users  │
         └───────────┬──────────────┘
                     ↓
         ┌──────────────────────────┐
         │  Send Email (Async)      │
         │  - Beautiful HTML        │
         │  - Full defect details   │
         │  - Defect image          │
         └──────────────────────────┘
```

---

**Status:** ✅ All implementations complete and tested
