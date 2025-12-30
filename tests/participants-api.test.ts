import { describe, it, expect } from 'vitest';

describe('Participants API', () => {
  it('should have participants loaded in database', async () => {
    // Test the tRPC API endpoint with proper query format
    const response = await fetch('http://localhost:3000/api/trpc/participants.list?batch=1&input=%7B%7D');
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Response error:', text);
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    expect(data[0]).toBeDefined();
    expect(data[0].result).toBeDefined();
    expect(data[0].result.data).toBeDefined();
    expect(data[0].result.data.json).toBeDefined();
    
    const participants = data[0].result.data.json;
    console.log(`Found ${participants ? participants.length : 0} participants in database`);
    
    // Should have at least 400 participants (we imported 416, one failed)
    expect(participants.length).toBeGreaterThanOrEqual(400);
    
    // Verify participant structure
    if (participants.length > 0) {
      const firstParticipant = participants[0];
      expect(firstParticipant).toHaveProperty('uuid');
      expect(firstParticipant).toHaveProperty('name');
      expect(firstParticipant).toHaveProperty('qrToken');
      console.log('Sample participant:', {
        name: firstParticipant.name,
        qrToken: firstParticipant.qrToken,
        bloodGroup: firstParticipant.bloodGroup,
        age: firstParticipant.age
      });
    }
  });
});
