import { readdirSync } from 'fs';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

// Parse the DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1).split('?')[0],
  ssl: { rejectUnauthorized: true }
};

async function verifyQRCodes() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('Connected successfully');

    // Get all QR code files
    const qrDir = './qr_codes_uploaded/qr_codes_v2';
    const qrFiles = readdirSync(qrDir).filter(f => f.endsWith('.png'));
    console.log(`Found ${qrFiles.length} QR code files`);

    // Get all participants from database
    const [participants] = await connection.execute('SELECT qrToken, name FROM participants ORDER BY qrToken');
    console.log(`Found ${participants.length} participants in database`);

    // Extract badge numbers from filenames
    const qrBadgeNumbers = qrFiles.map(f => {
      const match = f.match(/^(\d+)_/);
      return match ? parseInt(match[1]) : null;
    }).filter(n => n !== null).sort((a, b) => a - b);

    console.log(`\nQR Code Badge Numbers: ${qrBadgeNumbers.length} files`);
    console.log(`First: ${qrBadgeNumbers[0]}, Last: ${qrBadgeNumbers[qrBadgeNumbers.length - 1]}`);

    // Check for missing badge numbers
    const missingBadges = [];
    for (let i = 1; i <= 417; i++) {
      if (!qrBadgeNumbers.includes(i)) {
        missingBadges.push(i);
      }
    }

    if (missingBadges.length > 0) {
      console.log(`\n⚠️  Missing QR codes for badges: ${missingBadges.join(', ')}`);
    } else {
      console.log('\n✅ All 417 QR codes present');
    }

    // Verify database has all QR tokens
    const dbTokens = participants.map(p => p.qrToken);
    const missingInDb = [];
    for (let i = 1; i <= 417; i++) {
      const token = `PALITANA_YATRA_${i}`;
      if (!dbTokens.includes(token)) {
        missingInDb.push(i);
      }
    }

    if (missingInDb.length > 0) {
      console.log(`\n⚠️  Missing in database for badges: ${missingInDb.join(', ')}`);
    } else {
      console.log('✅ All 417 participants in database');
    }

    console.log('\n📊 Summary:');
    console.log(`- QR Code Files: ${qrFiles.length}`);
    console.log(`- Database Records: ${participants.length}`);
    console.log(`- Expected Total: 417`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyQRCodes();
