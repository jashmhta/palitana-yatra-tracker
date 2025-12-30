/**
 * Concurrent 25+ Volunteers Scan Test
 * Simulates real-world scenario with 25+ volunteers scanning at 3 checkpoints simultaneously
 * Tests database performance, duplicate prevention, and data consistency
 */

import { describe, it, expect, beforeAll } from "vitest";
import axios from "axios";

const API_URL = process.env.API_URL || "http://localhost:3000";
const TRPC_URL = `${API_URL}/api/trpc`;

describe("25+ Volunteers Concurrent Scanning", () => {
  let testParticipants: any[] = [];
  let createdScanIds: string[] = [];

  beforeAll(async () => {
    // Wait for server
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch all participants
    const response = await axios.get(`${TRPC_URL}/participants.list`);
    testParticipants = response.data.result.data.json;
    
    console.log(`\n📊 Test Setup: ${testParticipants.length} participants available\n`);
  });

  it("should handle 25 volunteers scanning different participants at Checkpoint 1 simultaneously", async () => {
    const NUM_VOLUNTEERS = 25;
    const CHECKPOINT_ID = 1; // Gheti
    
    console.log(`\n🔄 Simulating ${NUM_VOLUNTEERS} volunteers scanning at Checkpoint 1 (Gheti)...`);
    
    const startTime = Date.now();
    
    // Select 25 different participants for scanning (use higher indices to avoid previous test conflicts)
    const selectedParticipants = testParticipants.slice(300, 300 + NUM_VOLUNTEERS);
    
    // Create scan requests for all volunteers simultaneously
    const scanPromises = selectedParticipants.map((participant, index) => {
      const scanLog = {
        uuid: crypto.randomUUID(),
        participantUuid: participant.uuid,
        checkpointId: CHECKPOINT_ID,
        deviceId: `volunteer-device-${index + 1}`,
        gpsLat: "21.4272",
        gpsLng: "71.8244",
        scannedAt: new Date().toISOString(),
      };
      
      createdScanIds.push(scanLog.uuid);
      
      return axios.post(`${TRPC_URL}/scanLogs.create`, {
        json: scanLog,
      }).then(res => ({
        volunteer: index + 1,
        participant: participant.name,
        success: res.data.result.data.json.success || false,
        duplicate: res.data.result.data.json.duplicate || false,
        responseTime: Date.now() - startTime,
      })).catch(err => ({
        volunteer: index + 1,
        participant: participant.name,
        success: false,
        duplicate: false,
        error: err.message,
        responseTime: Date.now() - startTime,
      }));
    });
    
    const results = await Promise.all(scanPromises);
    const endTime = Date.now() - startTime;
    
    // Verify all scans succeeded
    const successfulScans = results.filter(r => r.success);
    const failedScans = results.filter(r => !r.success && !r.duplicate);
    
    console.log(`\n✅ Results:`);
    console.log(`   - Total volunteers: ${NUM_VOLUNTEERS}`);
    console.log(`   - Successful scans: ${successfulScans.length}`);
    console.log(`   - Failed scans: ${failedScans.length}`);
    console.log(`   - Total time: ${endTime}ms`);
    console.log(`   - Average time per scan: ${Math.round(endTime / NUM_VOLUNTEERS)}ms`);
    console.log(`   - Fastest scan: ${Math.min(...results.map(r => r.responseTime))}ms`);
    console.log(`   - Slowest scan: ${Math.max(...results.map(r => r.responseTime))}ms\n`);
    
    // Allow for some duplicates from previous test runs
    expect(successfulScans.length).toBeGreaterThanOrEqual(Math.floor(NUM_VOLUNTEERS * 0.5)); // At least 50% new scans
    const totalProcessed = successfulScans.length + results.filter(r => r.duplicate).length;
    expect(totalProcessed).toBe(NUM_VOLUNTEERS); // All should be processed (either success or duplicate)
    expect(endTime).toBeLessThan(10000); // Should complete within 10 seconds
  }, 15000);

  it("should handle 30 volunteers scanning across all 3 checkpoints simultaneously", async () => {
    const NUM_VOLUNTEERS = 30;
    const CHECKPOINTS = [1, 2, 3]; // Gheti, Khodiyar, Aamli
    
    console.log(`\n🔄 Simulating ${NUM_VOLUNTEERS} volunteers scanning across 3 checkpoints...`);
    
    const startTime = Date.now();
    
    // Distribute volunteers across checkpoints (10 per checkpoint)
    const scanPromises = [];
    
    for (let i = 0; i < NUM_VOLUNTEERS; i++) {
      const checkpointId = CHECKPOINTS[i % 3];
      const participantIndex = 350 + i; // Use different participants than previous test
      const participant = testParticipants[participantIndex];
      
      if (!participant) continue;
      
      const scanLog = {
        uuid: crypto.randomUUID(),
        participantUuid: participant.uuid,
        checkpointId,
        deviceId: `volunteer-device-multi-${i + 1}`,
        gpsLat: "21.4272",
        gpsLng: "71.8244",
        scannedAt: new Date().toISOString(),
      };
      
      createdScanIds.push(scanLog.uuid);
      
      scanPromises.push(
        axios.post(`${TRPC_URL}/scanLogs.create`, {
          json: scanLog,
        }).then(res => ({
          volunteer: i + 1,
          checkpoint: checkpointId,
          participant: participant.name,
          success: res.data.result.data.json.success || false,
          duplicate: res.data.result.data.json.duplicate || false,
        })).catch(err => ({
          volunteer: i + 1,
          checkpoint: checkpointId,
          participant: participant.name,
          success: false,
          duplicate: false,
          error: err.message,
        }))
      );
    }
    
    const results = await Promise.all(scanPromises);
    const endTime = Date.now() - startTime;
    
    const successfulScans = results.filter(r => r.success);
    const failedScans = results.filter(r => !r.success && !r.duplicate);
    
    // Group by checkpoint
    const checkpoint1 = results.filter(r => r.checkpoint === 1 && r.success).length;
    const checkpoint2 = results.filter(r => r.checkpoint === 2 && r.success).length;
    const checkpoint3 = results.filter(r => r.checkpoint === 3 && r.success).length;
    
    console.log(`\n✅ Results:`);
    console.log(`   - Total volunteers: ${NUM_VOLUNTEERS}`);
    console.log(`   - Successful scans: ${successfulScans.length}`);
    console.log(`   - Failed scans: ${failedScans.length}`);
    console.log(`   - Checkpoint 1 (Gheti): ${checkpoint1} scans`);
    console.log(`   - Checkpoint 2 (Khodiyar): ${checkpoint2} scans`);
    console.log(`   - Checkpoint 3 (Aamli): ${checkpoint3} scans`);
    console.log(`   - Total time: ${endTime}ms`);
    console.log(`   - Average time per scan: ${Math.round(endTime / NUM_VOLUNTEERS)}ms\n`);
    
    expect(successfulScans.length).toBeGreaterThanOrEqual(NUM_VOLUNTEERS * 0.9); // At least 90% success
    expect(endTime).toBeLessThan(15000); // Should complete within 15 seconds
  }, 20000);

  it("should prevent duplicate scans when same volunteer scans same participant twice", async () => {
    console.log(`\n🔄 Testing duplicate prevention...`);
    
    const participant = testParticipants[410]; // Use participant near the end to avoid conflicts
    const checkpointId = 1;
    
    const scanLog = {
      uuid: crypto.randomUUID(),
      participantUuid: participant.uuid,
      checkpointId,
      deviceId: "volunteer-device-duplicate-test",
      gpsLat: "21.4272",
      gpsLng: "71.8244",
      scannedAt: new Date().toISOString(),
    };
    
    // First scan - should succeed
    const firstScan = await axios.post(`${TRPC_URL}/scanLogs.create`, {
      json: scanLog,
    });
    
    const firstResult = firstScan.data.result.data.json;
    
    // Second scan - same participant, same checkpoint - should be marked as duplicate
    const duplicateScanLog = {
      ...scanLog,
      uuid: crypto.randomUUID(), // Different UUID
      scannedAt: new Date().toISOString(), // Different timestamp
    };
    
    const secondScan = await axios.post(`${TRPC_URL}/scanLogs.create`, {
      json: duplicateScanLog,
    });
    
    const secondResult = secondScan.data.result.data.json;
    
    console.log(`\n✅ Duplicate Prevention:`);
    console.log(`   - First scan: ${firstResult.success ? "SUCCESS" : "FAILED"}`);
    console.log(`   - Second scan (duplicate): ${secondResult.duplicate ? "PREVENTED" : "ALLOWED (ERROR!)"}`);
    console.log(`   - Participant: ${participant.name}`);
    console.log(`   - Checkpoint: ${checkpointId}\n`);
    
    expect(firstResult.success).toBe(true);
    expect(secondResult.duplicate).toBe(true);
    expect(secondResult.success).toBe(false);
    
    createdScanIds.push(scanLog.uuid);
  });

  it("should handle rapid sequential scans from single volunteer (stress test)", async () => {
    const NUM_SCANS = 10;
    const checkpointId = 2; // Khodiyar
    
    console.log(`\n🔄 Stress testing: ${NUM_SCANS} rapid sequential scans...`);
    
    const startTime = Date.now();
    const results = [];
    
    for (let i = 0; i < NUM_SCANS; i++) {
      const participant = testParticipants[380 + i];
      if (!participant) continue;
      
      const scanLog = {
        uuid: crypto.randomUUID(),
        participantUuid: participant.uuid,
        checkpointId,
        deviceId: "volunteer-device-rapid",
        gpsLat: "21.4272",
        gpsLng: "71.8244",
        scannedAt: new Date().toISOString(),
      };
      
      createdScanIds.push(scanLog.uuid);
      
      const scanStart = Date.now();
      const response = await axios.post(`${TRPC_URL}/scanLogs.create`, {
        json: scanLog,
      });
      const scanTime = Date.now() - scanStart;
      
      results.push({
        scan: i + 1,
        success: response.data.result.data.json.success,
        time: scanTime,
      });
    }
    
    const endTime = Date.now() - startTime;
    const avgTime = endTime / NUM_SCANS;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`\n✅ Rapid Scan Results:`);
    console.log(`   - Total scans: ${NUM_SCANS}`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Total time: ${endTime}ms`);
    console.log(`   - Average per scan: ${Math.round(avgTime)}ms`);
    console.log(`   - Fastest: ${Math.min(...results.map(r => r.time))}ms`);
    console.log(`   - Slowest: ${Math.max(...results.map(r => r.time))}ms\n`);
    
    // Allow for some duplicates from previous test runs
    expect(successCount).toBeGreaterThanOrEqual(Math.floor(NUM_SCANS * 0.5)); // At least 50% should succeed
    expect(avgTime).toBeLessThan(1000); // Each scan should average under 1 second
  }, 15000);

  it("should verify all scans are visible to all volunteers (real-time sync)", async () => {
    console.log(`\n🔄 Verifying real-time sync across volunteers...`);
    
    // Wait a moment for sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const NUM_VOLUNTEERS = 10;
    
    // Simulate 10 volunteers fetching scan logs simultaneously
    const fetchPromises = Array.from({ length: NUM_VOLUNTEERS }, (_, i) =>
      axios.get(`${TRPC_URL}/scanLogs.list`).then(res => ({
        volunteer: i + 1,
        totalScans: res.data.result.data.json.length,
      }))
    );
    
    const results = await Promise.all(fetchPromises);
    
    // All volunteers should see the same number of scans
    const firstCount = results[0].totalScans;
    const allSameCount = results.every(r => r.totalScans === firstCount);
    
    console.log(`\n✅ Real-Time Sync Verification:`);
    console.log(`   - Volunteers checked: ${NUM_VOLUNTEERS}`);
    console.log(`   - Total scans visible: ${firstCount}`);
    console.log(`   - All see same data: ${allSameCount ? "YES ✓" : "NO ✗"}`);
    
    results.forEach(r => {
      console.log(`   - Volunteer ${r.volunteer}: ${r.totalScans} scans`);
    });
    console.log();
    
    expect(allSameCount).toBe(true);
    expect(firstCount).toBeGreaterThan(0);
  });
});
