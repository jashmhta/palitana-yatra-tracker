/**
 * Server-Side Google Sheets Logger
 * Automatically logs every scan to Google Sheets in real-time
 * 
 * This service runs on the server and writes to Google Sheets whenever a scan is created.
 * No client-side configuration needed - all volunteers' scans are automatically logged.
 */

// Google Sheets configuration from environment variables

interface ScanLogData {
  uuid: string;
  participantUuid: string;
  participantName: string;
  participantBadge: string;
  checkpointId: number;
  checkpointName: string;
  deviceId: string | null;
  gpsLat: string | null;
  gpsLng: string | null;
  scannedAt: Date;
}

interface GoogleSheetsConfig {
  spreadsheetId: string;
  apiKey: string;
  enabled: boolean;
}

class GoogleSheetsLogger {
  private config: GoogleSheetsConfig | null = null;
  private baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  private isInitialized = false;
  private failedScans: ScanLogData[] = [];
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private maxRetryQueueSize = 1000; // Prevent memory issues

  /**
   * Initialize the Google Sheets logger with environment variables
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!spreadsheetId || !apiKey) {
      console.warn("[GoogleSheetsLogger] Not configured - scans will not be logged to Google Sheets");
      console.warn("[GoogleSheetsLogger] Set GOOGLE_SHEETS_ID and GOOGLE_SHEETS_API_KEY environment variables");
      this.config = null;
      this.isInitialized = true;
      return;
    }

    this.config = {
      spreadsheetId,
      apiKey,
      enabled: true,
    };

    this.isInitialized = true;
    console.log("[GoogleSheetsLogger] Initialized successfully");
    
    // Verify connection
    const connectionTest = await this.testConnection();
    if (!connectionTest.success) {
      console.error("[GoogleSheetsLogger] Connection test failed:", connectionTest.error);
      this.config.enabled = false;
    } else {
      console.log("[GoogleSheetsLogger] Connected to:", connectionTest.title);
    }
  }

  /**
   * Test connection to Google Sheets
   */
  async testConnection(): Promise<{ success: boolean; error?: string; title?: string }> {
    if (!this.config) {
      return { success: false, error: "Not configured" };
    }

    try {
      const url = `${this.baseUrl}/${this.config.spreadsheetId}?key=${this.config.apiKey}&fields=properties.title`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.json();
        return { 
          success: false, 
          error: error.error?.message || "Failed to connect" 
        };
      }

      const data = await response.json();
      return { 
        success: true, 
        title: data.properties?.title || "Untitled Spreadsheet"
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Network error" 
      };
    }
  }

  /**
   * Start the retry queue processor
   */
  private startRetryProcessor(): void {
    if (this.retryInterval) return;
    
    // Process failed scans every 30 seconds
    this.retryInterval = setInterval(async () => {
      if (this.failedScans.length === 0) return;
      
      console.log(`[GoogleSheetsLogger] Retrying ${this.failedScans.length} failed scans...`);
      
      const scansToRetry = [...this.failedScans];
      this.failedScans = [];
      
      for (const scan of scansToRetry) {
        const result = await this.logScanDirect(scan);
        if (!result.success) {
          // Add back to queue if still failing (up to max size)
          if (this.failedScans.length < this.maxRetryQueueSize) {
            this.failedScans.push(scan);
          } else {
            console.error(`[GoogleSheetsLogger] Dropping scan ${scan.uuid} - retry queue full`);
          }
        }
      }
      
      if (this.failedScans.length > 0) {
        console.log(`[GoogleSheetsLogger] ${this.failedScans.length} scans still pending retry`);
      }
    }, 30000);
  }

  /**
   * Direct log to Google Sheets (no retry queue)
   */
  private async logScanDirect(scanData: ScanLogData): Promise<{ success: boolean; error?: string }> {
    if (!this.config || !this.config.enabled) {
      return { success: true };
    }

    try {
      const row = [
        scanData.uuid,
        scanData.participantName,
        scanData.participantBadge,
        scanData.checkpointName,
        scanData.deviceId || "",
        scanData.gpsLat || "",
        scanData.gpsLng || "",
        scanData.scannedAt instanceof Date ? scanData.scannedAt.toISOString() : scanData.scannedAt,
      ];

      const url = `${this.baseUrl}/${this.config.spreadsheetId}/values/ScanLogs:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${this.config.apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [row],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("[GoogleSheetsLogger] Failed to log scan:", error);
        return { 
          success: false, 
          error: error.error?.message || "Failed to append to sheet" 
        };
      }

      console.log(`[GoogleSheetsLogger] Logged scan: ${scanData.participantName} at ${scanData.checkpointName}`);
      return { success: true };
    } catch (error) {
      console.error("[GoogleSheetsLogger] Error logging scan:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  /**
   * Log a scan to Google Sheets with automatic retry on failure
   * Sheet structure: UUID | Participant Name | Badge | Checkpoint | Device ID | GPS Lat | GPS Lng | Scanned At
   */
  async logScan(scanData: ScanLogData): Promise<{ success: boolean; error?: string }> {
    // Ensure initialized
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.config || !this.config.enabled) {
      // Silently skip if not configured
      return { success: true };
    }

    // Start retry processor if not running
    this.startRetryProcessor();

    const result = await this.logScanDirect(scanData);
    
    if (!result.success) {
      // Add to retry queue
      if (this.failedScans.length < this.maxRetryQueueSize) {
        this.failedScans.push(scanData);
        console.log(`[GoogleSheetsLogger] Added scan to retry queue (${this.failedScans.length} pending)`);
      }
    }
    
    return result;
  }

  /**
   * Bulk log multiple scans to Google Sheets
   */
  async logScans(scans: ScanLogData[]): Promise<{ success: boolean; logged: number; errors: number }> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.config || !this.config.enabled) {
      return { success: true, logged: 0, errors: 0 };
    }

    let logged = 0;
    let errors = 0;

    for (const scan of scans) {
      const result = await this.logScan(scan);
      if (result.success) {
        logged++;
      } else {
        errors++;
      }
    }

    return { success: errors === 0, logged, errors };
  }

  /**
   * Check if Google Sheets logging is enabled
   */
  isEnabled(): boolean {
    return this.config?.enabled || false;
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; enabled: boolean; spreadsheetId?: string } {
    return {
      configured: !!this.config,
      enabled: this.config?.enabled || false,
      spreadsheetId: this.config?.spreadsheetId,
    };
  }
}

// Export singleton instance
export const googleSheetsLogger = new GoogleSheetsLogger();

// Initialize on module load
googleSheetsLogger.init().catch((error) => {
  console.error("[GoogleSheetsLogger] Initialization failed:", error);
});
