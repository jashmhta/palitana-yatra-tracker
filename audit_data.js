const XLSX = require('xlsx');
const fs = require('fs');

// Read Excel file
const workbook = XLSX.readFile('/home/ubuntu/upload/IDCardData_2.xlsx');
const sheet = workbook.Sheets['Final Data'];
const excelData = XLSX.utils.sheet_to_json(sheet);

// We'll get database data from webdev_execute_sql output
// For now, create the audit structure
const excelByBadge = {};
excelData.forEach(row => {
  const badge = row['Badge Number'];
  if (badge) {
    excelByBadge[badge] = {
      name: (row['Name'] || '').trim(),
      mobile: (row['Emergency Contact'] || '').toString().trim(),
      age: row['Age'] || null,
      bloodGroup: (row['Blood Group'] || '').trim() || null,
      photoUri: (row['Drive Photo Link'] || '').trim() || null
    };
  }
});

console.log('Excel data loaded:',  Object.keys(excelByBadge).length, 'participants');
console.log('\nSample Excel data (Badge #1):');
console.log(JSON.stringify(excelByBadge[1], null, 2));
console.log('\nSample Excel data (Badge #417):');
console.log(JSON.stringify(excelByBadge[417], null, 2));

// Save for later comparison
fs.writeFileSync('excel_data_by_badge.json', JSON.stringify(excelByBadge, null, 2));
console.log('\n✅ Excel data exported to excel_data_by_badge.json');
