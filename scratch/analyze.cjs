const fs = require('fs');

const text = fs.readFileSync('scratch/sheet_data.csv', 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

console.log('Total lines (including header):', lines.length);
console.log('Header:', lines[0]);

// Simple CSV parser handling quotes
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

const monthsMap = new Map();
const itemsMap = new Map();
let totalQtyAll = 0;

for (let i = 1; i < lines.length; i++) {
  const [stockGroup, itemCode, itemDesc, month, qtyStr] = parseCSVLine(lines[i]);
  if (!itemCode || !month) continue;

  const qty = parseFloat((qtyStr || '0').replace(/,/g, '')) || 0;
  totalQtyAll += qty;

  const m = month.toUpperCase().trim();
  monthsMap.set(m, (monthsMap.get(m) || 0) + qty);

  const code = itemCode.trim();
  if (!itemsMap.has(code)) {
    itemsMap.set(code, {
      code,
      desc: itemDesc,
      stockGroup,
      totalQty: 0,
      months: {},
    });
  }
  const item = itemsMap.get(code);
  item.totalQty += qty;
  item.months[m] = (item.months[m] || 0) + qty;
}

console.log('\nMonths and total Qty:');
for (const [m, q] of monthsMap.entries()) {
  console.log(`${m}: ${q.toLocaleString()}`);
}

console.log('\nTotal unique items:', itemsMap.size);
console.log('Overall total quantity:', totalQtyAll.toLocaleString());

const sampleItems = Array.from(itemsMap.values()).slice(0, 5);
console.log('\nSample items:');
console.log(JSON.stringify(sampleItems, null, 2));
