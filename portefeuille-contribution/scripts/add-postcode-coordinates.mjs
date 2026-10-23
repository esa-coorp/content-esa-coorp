import { readFileSync, writeFileSync } from 'node:fs';

const [dataPath, referencePath] = process.argv.slice(2);
if (!dataPath || !referencePath) throw new Error('Usage: node add-postcode-coordinates.mjs <data.json> <cities.csv>');

const parseCsvLine = (line) => {
  const values = []; let current = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"' && line[i + 1] === '"' && quoted) { current += '"'; i += 1; }
    else if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ',' && !quoted) { values.push(current); current = ''; }
    else current += line[i];
  }
  values.push(current); return values;
};

const [header, ...lines] = readFileSync(referencePath, 'utf8').trim().split(/\r?\n/);
const columns = Object.fromEntries(parseCsvLine(header).map((name, index) => [name, index]));
const pointsByPostcode = new Map();
for (const line of lines) {
  const row = parseCsvLine(line);
  if (row[columns.valid_to]) continue;
  const postcode = row[columns.postal_code]?.padStart(5, '0');
  const latitude = Number(row[columns.latitude]), longitude = Number(row[columns.longitude]);
  if (!postcode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
  const point = { latitude, longitude, weight: Math.max(1, Number(row[columns.address_count]) || 1), source: row[columns.coordinate_source] };
  pointsByPostcode.set(postcode, [...(pointsByPostcode.get(postcode) || []), point]);
}

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const missing = new Set();
for (const account of data) {
  const points = pointsByPostcode.get(account.postcode);
  if (!points?.length) { missing.add(account.postcode); continue; }
  const weight = points.reduce((total, point) => total + point.weight, 0);
  account.latitude = points.reduce((total, point) => total + point.latitude * point.weight, 0) / weight;
  account.longitude = points.reduce((total, point) => total + point.longitude * point.weight, 0) / weight;
  account.coordinateSource = points.every((point) => point.source === 'ban') ? 'ban' : 'reference';
  account.coordinatePrecision = 'postal_code';
}
writeFileSync(dataPath, JSON.stringify(data));
console.log(JSON.stringify({ postcodes: new Set(data.map((account) => account.postcode)).size, matched: new Set(data.filter((account) => account.latitude).map((account) => account.postcode)).size, missing: [...missing] }));
