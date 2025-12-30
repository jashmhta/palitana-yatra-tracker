import { readFileSync } from 'fs';
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

async function importParticipants() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('Connected successfully');

    // Read the SQL file
    const sqlContent = readFileSync('./all_participants_v2.sql', 'utf8');
    
    // Split by INSERT statements
    const statements = sqlContent
      .split('\n')
      .filter(line => line.trim().startsWith('INSERT INTO participants'));

    console.log(`Found ${statements.length} INSERT statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      try {
        await connection.execute(statements[i]);
        if ((i + 1) % 50 === 0) {
          console.log(`Imported ${i + 1}/${statements.length} participants...`);
        }
      } catch (err) {
        console.error(`Error on statement ${i + 1}:`, err.message);
      }
    }

    console.log('Import completed!');

    // Verify count
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM participants');
    console.log(`Total participants in database: ${rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

importParticipants();
