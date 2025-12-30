import fs from 'fs';
import QRCode from 'qrcode';
import { createCanvas, loadImage } from 'canvas';

// Read participants data
const csvData = fs.readFileSync('/home/ubuntu/palitana-app/complete_participants.csv', 'utf8');
const lines = csvData.split('\n').filter(l => l.trim());
const participants = lines.slice(1).map(line => {
  const values = line.split(',');
  return {
    name: values[0],
    badgeNumber: parseInt(values[1])
  };
}).filter(p => p.badgeNumber && !isNaN(p.badgeNumber));

// Create QR codes directory
const qrDir = '/home/ubuntu/palitana-app/qr_codes';
if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir, { recursive: true });
}

console.log(`=== Generating QR Codes for ${participants.length} Participants ===\n`);

async function generateQRCodes() {
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const qrData = `PALITANA_YATRA_${p.badgeNumber}`;
    
    // Generate QR code as data URL
    const qrDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      width: 500,
      margin: 2
    });
    
    // Create canvas
    const canvas = createCanvas(600, 700);
    const ctx = canvas.getContext('2d');
    
    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 600, 700);
    
    // Load and draw QR code
    const qrImage = await loadImage(qrDataURL);
    ctx.drawImage(qrImage, 50, 50, 500, 500);
    
    // Draw badge number
    ctx.fillStyle = 'black';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Badge #${p.badgeNumber}`, 300, 600);
    
    // Draw name
    ctx.font = '24px sans-serif';
    ctx.fillText(p.name, 300, 650);
    
    // Save image
    const filename = `${String(p.badgeNumber).padStart(3, '0')}_${p.name.replace(/[\/\s]/g, '_')}.png`;
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`${qrDir}/${filename}`, buffer);
    
    if ((i + 1) % 50 === 0) {
      console.log(`Generated ${i + 1}/${participants.length} QR codes...`);
    }
  }
  
  console.log(`\n✅ Successfully generated ${participants.length} QR code images`);
  console.log(`Directory: ${qrDir}`);
}

generateQRCodes().catch(console.error);
