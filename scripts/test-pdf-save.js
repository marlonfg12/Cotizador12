const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

async function main() {
  const doc = new jsPDF();
  doc.text('Prueba cotizador', 10, 10);
  const dataUri = doc.output('datauristring');
  console.log('URI prefix:', dataUri.slice(0, 90));

  const pdfBase64 = dataUri.includes('base64,')
    ? dataUri.split('base64,').pop()
    : dataUri;

  const res = await fetch('http://localhost:3000/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folio: 'COT-2026-TEST', pdfBase64 }),
  });
  const json = await res.json();
  console.log('API:', json);

  const file = path.join(__dirname, 'pdf', 'COT-2026-TEST.pdf');
  const buf = fs.readFileSync(file);
  console.log('Saved bytes:', buf.length, 'header:', buf.slice(0, 5).toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
