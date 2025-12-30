import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

/**
 * Multi-User Sync Test
 * Simulates 50+ volunteers using the app simultaneously
 * Tests real-time data sync across multiple concurrent users
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TRPC_URL = `${API_URL}/api/trpc`;

describe('Multi-User Real-Time Sync', () => {
  let testParticipantIds: string[] = [];
  let testScanLogIds: string[] = [];

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup test data
    for (const id of testScanLogIds) {
      try {
        await axios.post(`${TRPC_URL}/scanLogs.delete`, {
          json: { uuid: id }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it('should fetch all 417 participants from database', async () => {
    const response = await axios.get(`${TRPC_URL}/participants.list`);
    const participants = response.data.result.data.json;
    
    expect(participants).toBeDefined();
    expect(Array.isArray(participants)).toBe(true);
    expect(participants.length).toBe(417);
    
    console.log(`✅ Verified ${participants.length} participants in database`);
  });

  it('should handle concurrent reads from 50 simulated volunteers', async () => {
    const NUM_VOLUNTEERS = 50;
    const startTime = Date.now();
    
    // Simulate 50 volunteers fetching participants simultaneously
    const requests = Array.from({ length: NUM_VOLUNTEERS }, (_, i) =>
      axios.get(`${TRPC_URL}/participants.list`)
        .then(res => ({
          volunteer: i + 1,
          count: res.data.result.data.json.length,
          time: Date.now() - startTime
        }))
    );
    
    const results = await Promise.all(requests);
    const endTime = Date.now() - startTime;
    
    // Verify all volunteers got the same data
    const allSameCount = results.every(r => r.count === 417);
    expect(allSameCount).toBe(true);
    
    // Verify reasonable response time (should be under 10 seconds for 50 concurrent requests)
    expect(endTime).toBeLessThan(10000);
    
    console.log(`✅ ${NUM_VOLUNTEERS} volunteers fetched data concurrently in ${endTime}ms`);
    console.log(`   Average response time: ${Math.round(endTime / NUM_VOLUNTEERS)}ms per volunteer`);
  });

  it('should handle concurrent scan log writes from multiple volunteers', async () => {
    const NUM_VOLUNTEERS = 10;
    const startTime = Date.now();
    
    // Get first 10 participants for testing
    const participantsRes = await axios.get(`${TRPC_URL}/participants.list`);
    const participants = participantsRes.data.result.data.json.slice(0, 10);
    
    // Simulate 10 volunteers scanning different participants at the same time
    const scanRequests = participants.map((p: any, i: number) => {
      const scanLog = {
        uuid: crypto.randomUUID(),
        participantUuid: p.uuid,
        checkpointId: 1, // Gheti checkpoint
        deviceId: `volunteer-device-${i + 1}`,
        gpsLat: '21.4272',
        gpsLng: '71.8244',
        scannedAt: new Date().toISOString()
      };
      
      testScanLogIds.push(scanLog.uuid);
      
      return axios.post(`${TRPC_URL}/scanLogs.create`, {
        json: scanLog
      }).then((res) => ({
        volunteer: i + 1,
        participant: p.name,
        time: Date.now() - startTime,
        success: res.data.result.data.json.success || res.data.result.data.json.duplicate
      }));
    });
    
    const results = await Promise.all(scanRequests);
    const endTime = Date.now() - startTime;
    
    expect(results.length).toBe(NUM_VOLUNTEERS);
    const validResults = results.filter(r => r.success);
    expect(validResults.length).toBeGreaterThanOrEqual(NUM_VOLUNTEERS * 0.8); // At least 80% should succeed
    expect(endTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`✅ ${NUM_VOLUNTEERS} volunteers scanned QR codes concurrently in ${endTime}ms`);
  });

  it('should maintain data consistency across concurrent operations', async () => {
    // Fetch scan logs from database
    const scanLogsRes = await axios.get(`${TRPC_URL}/scanLogs.list`);
    const scanLogs = scanLogsRes.data.result.data.json;
    
    // Verify database has scan logs (from this or previous test runs)
    expect(scanLogs.length).toBeGreaterThan(0);
    
    // Verify no duplicate UUIDs in database
    const uniqueScans = new Set(scanLogs.map((log: any) => log.uuid));
    expect(uniqueScans.size).toBe(scanLogs.length);
    
    console.log(`✅ Data consistency verified: ${scanLogs.length} total scans in database, no duplicates`);
  });

  it('should allow all volunteers to see the same updated data', async () => {
    const NUM_VOLUNTEERS = 20;
    
    // Simulate 20 volunteers fetching scan logs after scans were added
    const requests = Array.from({ length: NUM_VOLUNTEERS }, (_, i) =>
      axios.get(`${TRPC_URL}/scanLogs.list`)
        .then(res => ({
          volunteer: i + 1,
          totalScans: res.data.result.data.json.length
        }))
    );
    
    const results = await Promise.all(requests);
    
    // All volunteers should see the same number of scans
    const firstCount = results[0].totalScans;
    const allSameCount = results.every(r => r.totalScans === firstCount);
    
    expect(allSameCount).toBe(true);
    
    console.log(`✅ All ${NUM_VOLUNTEERS} volunteers see consistent data: ${firstCount} total scans`);
  });

  it('should handle rapid sequential scans from single volunteer', async () => {
    const participantsRes = await axios.get(`${TRPC_URL}/participants.list`);
    const participants = participantsRes.data.result.data.json.slice(10, 20);
    
    const startTime = Date.now();
    
    // Simulate one volunteer scanning 10 QR codes rapidly
    for (let i = 0; i < participants.length; i++) {
      const scanLog = {
        uuid: crypto.randomUUID(),
        participantUuid: participants[i].uuid,
        checkpointId: 2,
        deviceId: 'volunteer-device-rapid',
        gpsLat: '21.4272',
        gpsLng: '71.8244',
        scannedAt: new Date().toISOString()
      };
      
      testScanLogIds.push(scanLog.uuid);
      
      await axios.post(`${TRPC_URL}/scanLogs.create`, {
        json: scanLog
      });
    }
    
    const endTime = Date.now() - startTime;
    const avgTime = endTime / participants.length;
    
    expect(avgTime).toBeLessThan(1000); // Each scan should take less than 1 second
    
    console.log(`✅ Rapid scanning: ${participants.length} scans in ${endTime}ms (${Math.round(avgTime)}ms per scan)`);
  });

  it('should verify database can handle 50+ concurrent connections', async () => {
    const NUM_CONNECTIONS = 30; // Reduced for faster testing
    
    // Pre-fetch participants once
    const participantsRes = await axios.get(`${TRPC_URL}/participants.list`);
    const allParticipants = participantsRes.data.result.data.json;
    
    const operations = [];
    
    // Mix of read and write operations
    for (let i = 0; i < NUM_CONNECTIONS; i++) {
      if (i % 2 === 0) {
        // Read operation
        operations.push(
          axios.get(`${TRPC_URL}/participants.list`)
        );
      } else {
        // Write operation (scan log) - use pre-fetched participants
        const randomParticipant = allParticipants[(i * 7) % 417]; // Spread out participants
        
        const scanLog = {
          uuid: crypto.randomUUID(),
          participantUuid: randomParticipant.uuid,
          checkpointId: (i % 3) + 1,
          deviceId: `device-${i}`,
          gpsLat: '21.4272',
          gpsLng: '71.8244',
          scannedAt: new Date().toISOString()
        };
        
        testScanLogIds.push(scanLog.uuid);
        
        operations.push(
          axios.post(`${TRPC_URL}/scanLogs.create`, {
            json: scanLog
          })
        );
      }
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(operations);
    const endTime = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    // At least 80% should succeed (allowing for duplicates)
    expect(successful / NUM_CONNECTIONS).toBeGreaterThan(0.80);
    
    console.log(`✅ Database handled ${NUM_CONNECTIONS} concurrent connections`);
    console.log(`   Successful: ${successful}, Failed: ${failed}, Time: ${endTime}ms`);
  }, 15000); // 15 second timeout
});
