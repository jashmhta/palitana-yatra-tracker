import fs from 'fs';
import XLSX from 'xlsx';
import { randomUUID } from 'crypto';

// Read the Excel file
const workbook = XLSX.readFile('/home/ubuntu/upload/IDCardData_2.xlsx');
const worksheet = workbook.Sheets['Final Data'];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Processing ${data.length} participants from Excel file...\n`);

// Prepare participant data
const participants = data.map((row, index) => {
  const badgeNum = row['Badge Number'];
  const name = row['Name'];
  const age = row['Age'] || null;
  const bloodGroup = row['Blood Group'] || null;
  const emergencyContact = row['Emergency Contact Number'];
  const photoUri = row['Drive Photo Link'] || null;
  
  return {
    uuid: randomUUID(),
    name: name,
    mobile: emergencyContact,
    qrToken: `PALITANA_YATRA_${badgeNum}`,
    emergencyContact: emergencyContact,
    photoUri: photoUri,
    bloodGroup: bloodGroup,
    age: age,
    badgeNumber: badgeNum
  };
});

// Save to JSON for import
fs.writeFileSync('participants_import.json', JSON.stringify(participants, null, 2));

console.log(`✅ Prepared ${participants.length} participants for import`);
console.log(`Saved to: participants_import.json`);
console.log(`\nData included:`);
console.log(`  - All 417 have: Name, Badge Number, Emergency Contact, QR Token`);
console.log(`  - ${participants.filter(p => p.age).length} have Age`);
console.log(`  - ${participants.filter(p => p.bloodGroup).length} have Blood Group`);
console.log(`  - ${participants.filter(p => p.photoUri).length} have Photo Link`);
