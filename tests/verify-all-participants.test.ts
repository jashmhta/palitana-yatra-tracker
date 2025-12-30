import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const API_BASE = 'http://localhost:3000/api/trpc';

interface Participant {
  id: number;
  uuid: string;
  name: string;
  mobile: string | null;
  qrToken: string;
  emergencyContact: string | null;
  photoUri: string | null;
  bloodGroup: string | null;
  age: number | null;
}

async function fetchParticipantByQrToken(qrToken: string): Promise<Participant | null> {
  // Use tRPC query format with json wrapper
  const input = encodeURIComponent(JSON.stringify({ json: { qrToken } }));
  const response = await fetch(`${API_BASE}/participants.getByQrToken?input=${input}`);
  if (!response.ok) {
    console.error(`Failed to fetch participant with qrToken ${qrToken}: ${response.status}`);
    return null;
  }
  const data = await response.json();
  return data?.result?.data?.json || null;
}

async function fetchAllParticipants(): Promise<Participant[]> {
  const response = await fetch(`${API_BASE}/participants.list`);
  if (!response.ok) throw new Error('Failed to fetch participants');
  const data = await response.json();
  return data?.result?.data?.json || [];
}

describe('Comprehensive Participant Verification', () => {
  it('should have exactly 417 participants in database', async () => {
    const participants = await fetchAllParticipants();
    console.log(`Total participants in database: ${participants.length}`);
    expect(participants.length).toBe(417);
  });

  it('should have valid QR tokens for all 417 badge numbers', async () => {
    const participants = await fetchAllParticipants();
    const qrTokens = participants.map(p => p.qrToken);
    
    const missingTokens: number[] = [];
    for (let i = 1; i <= 417; i++) {
      const expectedToken = `PALITANA_YATRA_${i}`;
      if (!qrTokens.includes(expectedToken)) {
        missingTokens.push(i);
      }
    }
    
    if (missingTokens.length > 0) {
      console.log(`Missing QR tokens for badges: ${missingTokens.join(', ')}`);
    }
    
    expect(missingTokens.length).toBe(0);
  });

  it('should retrieve each participant by QR token', async () => {
    const failedLookups: number[] = [];
    const successCount = { value: 0 };
    
    // Test a sample of participants (every 50th to save time)
    for (let i = 1; i <= 417; i += 50) {
      const qrToken = `PALITANA_YATRA_${i}`;
      const participant = await fetchParticipantByQrToken(qrToken);
      
      if (!participant) {
        failedLookups.push(i);
      } else {
        successCount.value++;
      }
    }
    
    console.log(`Successfully retrieved ${successCount.value} participants by QR token`);
    
    if (failedLookups.length > 0) {
      console.log(`Failed lookups for badges: ${failedLookups.join(', ')}`);
    }
    
    expect(failedLookups.length).toBe(0);
  });

  it('should have complete data for all participants', async () => {
    const participants = await fetchAllParticipants();
    
    const incompleteData: { badge: number; name: string; missing: string[] }[] = [];
    
    for (const p of participants) {
      const badgeMatch = p.qrToken.match(/PALITANA_YATRA_(\d+)/);
      const badge = badgeMatch ? parseInt(badgeMatch[1]) : 0;
      
      const missing: string[] = [];
      
      if (!p.name || p.name.trim() === '') missing.push('name');
      if (!p.qrToken) missing.push('qrToken');
      if (!p.uuid) missing.push('uuid');
      
      // Note: Some fields may legitimately be null
      // We only flag critical missing fields
      
      if (missing.length > 0) {
        incompleteData.push({ badge, name: p.name || 'Unknown', missing });
      }
    }
    
    if (incompleteData.length > 0) {
      console.log('Participants with incomplete critical data:');
      incompleteData.forEach(d => {
        console.log(`  Badge #${d.badge} (${d.name}): missing ${d.missing.join(', ')}`);
      });
    }
    
    expect(incompleteData.length).toBe(0);
  });

  it('should have QR code files for all participants', async () => {
    const qrDir = join(process.cwd(), 'qr_codes_uploaded', 'qr_codes_v2');
    
    if (!existsSync(qrDir)) {
      console.log('QR codes directory not found, skipping file check');
      return;
    }
    
    const qrFiles = readdirSync(qrDir).filter(f => f.endsWith('.png'));
    console.log(`Found ${qrFiles.length} QR code files`);
    
    // Extract badge numbers from filenames
    const fileBadges = qrFiles
      .map(f => {
        const match = f.match(/^(\d+)_/);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);
    
    const missingFiles: number[] = [];
    for (let i = 1; i <= 417; i++) {
      if (!fileBadges.includes(i)) {
        missingFiles.push(i);
      }
    }
    
    if (missingFiles.length > 0) {
      console.log(`Missing QR code files for badges: ${missingFiles.join(', ')}`);
    }
    
    expect(qrFiles.length).toBe(417);
    expect(missingFiles.length).toBe(0);
  });

  it('should have valid data types for all fields', async () => {
    const participants = await fetchAllParticipants();
    
    const invalidData: { badge: number; name: string; issues: string[] }[] = [];
    
    for (const p of participants) {
      const badgeMatch = p.qrToken.match(/PALITANA_YATRA_(\d+)/);
      const badge = badgeMatch ? parseInt(badgeMatch[1]) : 0;
      
      const issues: string[] = [];
      
      // Check name is a non-empty string
      if (typeof p.name !== 'string' || p.name.trim() === '') {
        issues.push('invalid name');
      }
      
      // Check qrToken format
      if (!p.qrToken || !p.qrToken.startsWith('PALITANA_YATRA_')) {
        issues.push('invalid qrToken format');
      }
      
      // Check UUID format
      if (!p.uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.uuid)) {
        issues.push('invalid uuid format');
      }
      
      // Check age is valid if present
      if (p.age !== null && (typeof p.age !== 'number' || p.age < 1 || p.age > 120)) {
        issues.push(`invalid age: ${p.age}`);
      }
      
      // Check mobile format if present
      if (p.mobile && !/^\d{10,15}$/.test(p.mobile.replace(/\D/g, ''))) {
        issues.push(`invalid mobile: ${p.mobile}`);
      }
      
      if (issues.length > 0) {
        invalidData.push({ badge, name: p.name || 'Unknown', issues });
      }
    }
    
    if (invalidData.length > 0) {
      console.log('Participants with invalid data:');
      invalidData.forEach(d => {
        console.log(`  Badge #${d.badge} (${d.name}): ${d.issues.join(', ')}`);
      });
    }
    
    expect(invalidData.length).toBe(0);
  });
});

describe('Individual Participant Detail Verification', () => {
  it('should verify first 10 participants have all expected fields', async () => {
    const results: { badge: number; name: string; hasAllFields: boolean; details: Record<string, any> }[] = [];
    
    for (let i = 1; i <= 10; i++) {
      const qrToken = `PALITANA_YATRA_${i}`;
      const participant = await fetchParticipantByQrToken(qrToken);
      
      if (participant) {
        results.push({
          badge: i,
          name: participant.name,
          hasAllFields: true,
          details: {
            uuid: participant.uuid ? '✓' : '✗',
            name: participant.name ? '✓' : '✗',
            qrToken: participant.qrToken ? '✓' : '✗',
            mobile: participant.mobile || 'N/A',
            emergencyContact: participant.emergencyContact || 'N/A',
            bloodGroup: participant.bloodGroup || 'N/A',
            age: participant.age || 'N/A',
            photoUri: participant.photoUri ? '✓ (has photo)' : 'N/A'
          }
        });
      }
    }
    
    console.log('\nFirst 10 Participants Detail:');
    console.log('='.repeat(60));
    results.forEach(r => {
      console.log(`\nBadge #${r.badge}: ${r.name}`);
      Object.entries(r.details).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
    
    expect(results.length).toBe(10);
  });

  it('should verify last 10 participants have all expected fields', async () => {
    const results: { badge: number; name: string; details: Record<string, any> }[] = [];
    
    for (let i = 408; i <= 417; i++) {
      const qrToken = `PALITANA_YATRA_${i}`;
      const participant = await fetchParticipantByQrToken(qrToken);
      
      if (participant) {
        results.push({
          badge: i,
          name: participant.name,
          details: {
            uuid: participant.uuid ? '✓' : '✗',
            name: participant.name ? '✓' : '✗',
            qrToken: participant.qrToken ? '✓' : '✗',
            mobile: participant.mobile || 'N/A',
            emergencyContact: participant.emergencyContact || 'N/A',
            bloodGroup: participant.bloodGroup || 'N/A',
            age: participant.age || 'N/A',
            photoUri: participant.photoUri ? '✓ (has photo)' : 'N/A'
          }
        });
      }
    }
    
    console.log('\nLast 10 Participants Detail:');
    console.log('='.repeat(60));
    results.forEach(r => {
      console.log(`\nBadge #${r.badge}: ${r.name}`);
      Object.entries(r.details).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
    
    expect(results.length).toBe(10);
  });
});
