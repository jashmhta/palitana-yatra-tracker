# Google Sheets Automatic Logging Setup

## Overview

The Palitana Yatra app automatically logs every scan to a Google Sheet in real-time. This ensures all volunteer scans are centralized and accessible via Google Sheets for reporting and analysis.

## Setup Instructions

### 1. Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "Palitana Yatra Scan Logs" (or any name you prefer)
4. Create a sheet named **"ScanLogs"** (exact name, case-sensitive)
5. Add the following headers in Row 1:
   - Column A: **UUID**
   - Column B: **Participant Name**
   - Column C: **Badge**
   - Column D: **Checkpoint**
   - Column E: **Device ID**
   - Column F: **GPS Lat**
   - Column G: **GPS Lng**
   - Column H: **Scanned At**

### 2. Get the Spreadsheet ID

1. Open your Google Sheet
2. Look at the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Copy the **SPREADSHEET_ID** part (long string between `/d/` and `/edit`)

### 3. Get a Google Sheets API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create an API Key:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

### 4. Make the Sheet Publicly Writable (Required for API Key method)

**Option A: Public Write Access (Simpler, less secure)**
1. Click "Share" button in your Google Sheet
2. Change "Restricted" to "Anyone with the link"
3. Change permission to "Editor"

**Option B: Service Account (More secure, recommended for production)**
1. In Google Cloud Console, create a Service Account
2. Download the JSON key file
3. Share your Google Sheet with the service account email
4. Use the service account credentials instead of API key

### 5. Configure Environment Variables

Add these environment variables to your deployment:

```bash
GOOGLE_SHEETS_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_API_KEY=your_api_key_here
```

**For local development:**
Create a `.env` file in the project root:
```
GOOGLE_SHEETS_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_API_KEY=your_api_key_here
```

### 6. Restart the Server

After setting the environment variables, restart the development server:
```bash
pnpm dev
```

Or restart the production server if deployed.

## Verification

1. Check the server logs for:
   ```
   [GoogleSheetsLogger] Initialized successfully
   [GoogleSheetsLogger] Connected to: Your Sheet Name
   ```

2. Make a test scan in the app
3. Check your Google Sheet - you should see a new row with the scan data

## Data Format

Each scan creates a new row with:
- **UUID**: Unique identifier for the scan
- **Participant Name**: Full name of the participant
- **Badge**: Badge number (1-417)
- **Checkpoint**: Checkpoint name (Gheti, Khodiyar, or Aamli)
- **Device ID**: Unique identifier for the volunteer's device
- **GPS Lat**: GPS latitude (if available)
- **GPS Lng**: GPS longitude (if available)
- **Scanned At**: ISO timestamp of when the scan occurred

## Troubleshooting

### "Not configured" message in logs
- Ensure `GOOGLE_SHEETS_ID` and `GOOGLE_SHEETS_API_KEY` environment variables are set
- Restart the server after setting variables

### "Failed to connect" error
- Verify the Spreadsheet ID is correct
- Verify the API key is valid
- Check that the Google Sheets API is enabled in Google Cloud Console

### "Failed to append to sheet" error
- Ensure the sheet is named exactly "ScanLogs" (case-sensitive)
- Verify the sheet has write permissions (see Step 4)
- Check that the API key has proper permissions

### Scans not appearing in Google Sheets
- Check server logs for errors
- Verify the sheet name is exactly "ScanLogs"
- Ensure headers are in Row 1 (UUID, Participant Name, Badge, etc.)

## Important Notes

1. **Non-blocking**: Google Sheets logging is asynchronous and won't slow down scans
2. **Fault-tolerant**: If Google Sheets logging fails, scans still succeed and are saved to the database
3. **Real-time**: Scans appear in Google Sheets within 1-2 seconds
4. **All volunteers**: Every scan from every volunteer device is automatically logged
5. **No app configuration needed**: Once server is configured, all volunteers automatically benefit

## Security Recommendations

For production use:
1. Use a Service Account instead of API key
2. Restrict API key to Google Sheets API only
3. Set HTTP referrer restrictions on the API key
4. Use environment variables (never commit credentials to code)
5. Regularly rotate API keys

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all setup steps are completed
3. Test the Google Sheets API connection manually
4. Contact support with error logs if needed
