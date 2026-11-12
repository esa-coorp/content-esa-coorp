import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node build-postcode-reference.mjs <cities.csv> <reference.js>');
const parse = line => { const values = []; let current = '', quoted = false; for (let index = 0; index < line.length; index += 1) { if (line[index] === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; } else if (line[index] === '"') quoted = !quoted; else if (line[index] === ',' && !quoted) { values.push(current); current = ''; } else current += line[index]; } values.push(current); return values; };
const postcode = value => String(value || '').replace(/\D/g, '').padStart(5, '0').slice(-5);
const [header, ...lines] = readFileSync(input, 'utf8').trim().split(/\r?\n/);
const columns = Object.fromEntries(parse(header).map((name, index) => [name, index]));
const points = new Map();
for (const line of lines) {
  const row = parse(line); if (row[columns.valid_to]) continue;
  const code = postcode(row[columns.postal_code]), latitude = Number(row[columns.latitude]), longitude = Number(row[columns.longitude]), weight = Math.max(1, Number(row[columns.address_count]) || 1);
  if (!code || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
  const point = points.get(code) || {latitude: 0, longitude: 0, weight: 0}; point.latitude += latitude * weight; point.longitude += longitude * weight; point.weight += weight; points.set(code, point);
}
const reference = Object.fromEntries([...points].map(([code, point]) => [code, [Number((point.latitude / point.weight).toFixed(6)), Number((point.longitude / point.weight).toFixed(6))]]));
writeFileSync(output, `window.PORTFOLIO_POSTCODES=${JSON.stringify(reference)};\n`);
console.log(JSON.stringify({postcodes: Object.keys(reference).length}));
