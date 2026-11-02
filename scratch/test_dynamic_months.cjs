const fs = require('fs');

const text = fs.readFileSync('scratch/sheet_data.csv', 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

const headerCols = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
console.log('Detected headers:', headerCols);

const CALENDAR_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

// Dynamically collect whatever months appear in the data
const monthsInFile = new Set();
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const m = cols[3]?.trim().toUpperCase();
  if (m) monthsInFile.add(m);
}

console.log('Months dynamically found in file:', Array.from(monthsInFile));

// Sort dynamically found months by calendar order
const sortedMonths = Array.from(monthsInFile).sort((a, b) => {
  const ia = CALENDAR_MONTHS.findIndex((m) => a.startsWith(m));
  const ib = CALENDAR_MONTHS.findIndex((m) => b.startsWith(m));
  return ia - ib;
});

console.log('Chronologically sorted months:', sortedMonths);
