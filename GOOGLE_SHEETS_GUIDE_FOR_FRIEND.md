# Google Sheets API Setup Guide
## For Non-Technical Users

**Purpose:** This guide will help you create a Google Sheet and generate API credentials so the Palitana Yatra app can automatically log all scans.

**Time Required:** 10-15 minutes

---

## Step 1: Create the Google Sheet

1. **Go to Google Sheets**
   - Open your web browser
   - Go to: https://sheets.google.com
   - Sign in with your Google account

2. **Create a New Spreadsheet**
   - Click the **"+ Blank"** button (or "+ Blank spreadsheet")
   - A new spreadsheet will open

3. **Name the Spreadsheet**
   - Click on "Untitled spreadsheet" at the top
   - Type: **"Palitana Yatra Scan Logs"**
   - Press Enter

4. **Rename the Sheet Tab**
   - At the bottom left, you'll see a tab named "Sheet1"
   - Right-click on "Sheet1"
   - Select "Rename"
   - Type exactly: **ScanLogs** (no spaces, capital S and L)
   - Press Enter
   - ⚠️ **IMPORTANT:** The name must be exactly "ScanLogs" - this is case-sensitive!

5. **Add Column Headers**
   - Click on cell A1 and type: **UUID**
   - Click on cell B1 and type: **Participant Name**
   - Click on cell C1 and type: **Badge**
   - Click on cell D1 and type: **Checkpoint**
   - Click on cell E1 and type: **Device ID**
   - Click on cell F1 and type: **GPS Lat**
   - Click on cell G1 and type: **GPS Lng**
   - Click on cell H1 and type: **Scanned At**

6. **Format the Headers (Optional but Recommended)**
   - Select cells A1 to H1 (click A1, hold Shift, click H1)
   - Click the **Bold** button (B icon) in the toolbar
   - Click the **Background color** button and choose a light color
   - This makes it easier to see the headers

7. **Get the Spreadsheet ID**
   - Look at the URL in your browser's address bar
   - It looks like: `https://docs.google.com/spreadsheets/d/LONG_STRING_HERE/edit`
   - Copy the **LONG_STRING_HERE** part (between `/d/` and `/edit`)
   - Example: If URL is `https://docs.google.com/spreadsheets/d/1abc123XYZ456def/edit`
   - Then Spreadsheet ID is: `1abc123XYZ456def`
   - **Paste this ID into a text file** - you'll need to send this later

---

## Step 2: Create Google Cloud Project and Enable API

1. **Go to Google Cloud Console**
   - Open a new browser tab
   - Go to: https://console.cloud.google.com
   - Sign in with the **same Google account** you used for the spreadsheet

2. **Create a New Project**
   - At the top of the page, click on the project dropdown (says "Select a project" or shows current project name)
   - Click **"NEW PROJECT"** button in the top-right of the popup
   - Project name: Type **"Palitana Yatra App"**
   - Click **"CREATE"**
   - Wait 10-20 seconds for the project to be created
   - You'll see a notification when it's ready

3. **Select Your New Project**
   - Click the project dropdown again at the top
   - Click on **"Palitana Yatra App"** to select it
   - Make sure it shows "Palitana Yatra App" at the top

4. **Enable Google Sheets API**
   - In the left sidebar, click **"APIs & Services"**
   - Click **"Library"**
   - In the search box, type: **Google Sheets API**
   - Click on **"Google Sheets API"** in the results
   - Click the blue **"ENABLE"** button
   - Wait a few seconds - you'll see "API enabled" message

---

## Step 3: Create API Key

1. **Go to Credentials Page**
   - In the left sidebar, click **"Credentials"**
   - Click the blue **"+ CREATE CREDENTIALS"** button at the top
   - Select **"API key"** from the dropdown

2. **Copy Your API Key**
   - A popup will appear showing your API key
   - It looks like: `AIzaSyABC123XYZ456...` (long string starting with AIza)
   - Click **"COPY"** button
   - **Paste this key into your text file** - you'll need to send this

3. **Restrict the API Key (Important for Security)**
   - In the popup, click **"EDIT API KEY"** or **"RESTRICT KEY"**
   - Under "API restrictions", select **"Restrict key"**
   - Click **"Select APIs"** dropdown
   - Find and check **"Google Sheets API"**
   - Uncheck any other APIs if they're selected
   - Click **"OK"**
   - Click **"SAVE"** at the bottom
   - Wait for "API key saved" message

---

## Step 4: Make the Spreadsheet Publicly Writable

⚠️ **Important:** The app needs to write data to your sheet. You have two options:

### Option A: Public Write Access (Simpler, but less secure)

1. Go back to your Google Sheet tab
2. Click the **"Share"** button in the top-right
3. Under "General access", click **"Restricted"**
4. Change it to **"Anyone with the link"**
5. Change the permission from "Viewer" to **"Editor"**
6. Click **"Done"**

⚠️ **Note:** This means anyone with the link can edit the sheet. For a private event, this is usually fine.

### Option B: Service Account (More secure, but more complex)

If you want better security, follow these additional steps:

1. **Create Service Account**
   - Go back to Google Cloud Console
   - Click "Credentials" in the left sidebar
   - Click "+ CREATE CREDENTIALS" → "Service account"
   - Service account name: "Palitana Yatra Service"
   - Click "CREATE AND CONTINUE"
   - Skip the optional steps, click "DONE"

2. **Get Service Account Email**
   - You'll see your service account in the list
   - It looks like: `palitana-yatra-service@project-name.iam.gserviceaccount.com`
   - Copy this email address

3. **Share Sheet with Service Account**
   - Go back to your Google Sheet
   - Click "Share" button
   - Paste the service account email
   - Change permission to "Editor"
   - Click "Send"

4. **Create Service Account Key**
   - Go back to Google Cloud Console → Credentials
   - Click on your service account name
   - Click "KEYS" tab
   - Click "ADD KEY" → "Create new key"
   - Choose "JSON"
   - Click "CREATE"
   - A JSON file will download - **save this file securely**
   - You'll need to send this file instead of the API key

---

## Step 5: Send Information to Your Friend

**You need to send these items:**

### If Using Option A (Public Write Access):
1. **Spreadsheet ID** (the long string from Step 1.7)
2. **API Key** (starts with AIza... from Step 3.2)

### If Using Option B (Service Account):
1. **Spreadsheet ID** (the long string from Step 1.7)
2. **Service Account JSON file** (downloaded in Step 4.4)

**How to Send:**

Create a message like this:

```
Hi! I've set up the Google Sheet for Palitana Yatra scans.

Spreadsheet ID: [paste your ID here]
API Key: [paste your key here]

The sheet is ready at: [paste the full Google Sheets URL]

Let me know if you need anything else!
```

**Security Tips:**
- Send via a secure method (email, WhatsApp, etc.)
- Don't post these publicly
- Your friend will add them to the server securely

---

## Step 6: Verify It's Working (After Your Friend Sets It Up)

1. Your friend will configure the app with your credentials
2. When volunteers start scanning, you should see rows appearing in your Google Sheet automatically
3. Each scan will create a new row with:
   - UUID (unique ID)
   - Participant name
   - Badge number
   - Checkpoint name
   - Device ID
   - GPS coordinates
   - Timestamp

---

## Troubleshooting

### "API key not valid" error
- Make sure you copied the entire API key (starts with AIza)
- Check that Google Sheets API is enabled
- Verify the API key restrictions are set correctly

### "Permission denied" error
- Make sure the sheet is shared properly (Option A or B above)
- Verify the sheet name is exactly "ScanLogs" (case-sensitive)

### Scans not appearing in sheet
- Check that your friend has configured the credentials correctly
- Verify the Spreadsheet ID is correct
- Make sure the sheet tab is named exactly "ScanLogs"

---

## Questions?

If you have any questions while following this guide:
1. Take a screenshot of where you're stuck
2. Send it to your friend
3. They can help troubleshoot or contact technical support

---

## Summary Checklist

Before sending information to your friend, verify:

- [ ] Google Sheet created and named "Palitana Yatra Scan Logs"
- [ ] Sheet tab renamed to exactly "ScanLogs"
- [ ] Headers added in row 1 (UUID, Participant Name, Badge, etc.)
- [ ] Spreadsheet ID copied from URL
- [ ] Google Cloud project created
- [ ] Google Sheets API enabled
- [ ] API key created and copied
- [ ] API key restricted to Google Sheets API only
- [ ] Sheet shared publicly as Editor OR shared with service account
- [ ] All information saved in a text file ready to send

**You're all set! Send the information to your friend and they'll integrate it with the app.** 🎉
