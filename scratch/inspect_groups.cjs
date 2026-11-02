const fs = require('fs');

const text = fs.readFileSync('scratch/sheet_data.csv', 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

function parseCSVLine(line) {
  const result = [];
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
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const monthsSeen = new Set();
const stockGroupsSeen = new Set();
let rowsCount = 0;

for (let i = 1; i < lines.length; i++) {
  const [stockGroup, itemCode, itemDesc, month, qtyStr] = parseCSVLine(lines[i]);
  if (!itemCode || !month) continue;
  rowsCount++;
  monthsSeen.add(month.toUpperCase().trim());
  if (stockGroup) stockGroupsSeen.add(stockGroup.trim());
}

console.log('Valid rows:', rowsCount);
console.log('Months seen:', Array.from(monthsSeen));
console.log('Stock groups seen:', Array.from(stockGroupsSeen));
