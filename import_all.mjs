import fs from 'fs';
import { createConnection } from 'mysql2/promise';

async function importAll() {
  const connection = await createConnection({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT || 3306,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  console.log('✅ Connected to database');

  // Read all batch files
  const batchFiles = [];
  for (let i = 1; i <= 21; i++) {
    const filename = `batch_${String(i).padStart(3, '0')}.sql`;
    batchFiles.push(filename);
  }

  let totalImported = 0;

  for (const filename of batchFiles) {
    const sql = fs.readFileSync(filename, 'utf8');
    const statements = sql.split('\n').filter(s => s.trim());
    
    for (const stmt of statements) {
      try {
        await connection.query(stmt);
        totalImported++;
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }
    }
    
    console.log(`Imported batch ${filename}: ${totalImported} total so far`);
  }

  await connection.end();
  console.log(`\n✅ Successfully imported ${totalImported} participants`);
}

importAll().catch(console.error);
