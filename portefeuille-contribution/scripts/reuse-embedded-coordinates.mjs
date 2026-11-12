import { readFileSync, writeFileSync } from 'node:fs';

const [dataPath, htmlPath] = process.argv.slice(2);
if (!dataPath || !htmlPath) throw new Error('Usage: node reuse-embedded-coordinates.mjs <data.json> <previous-index.html>');

const html = readFileSync(htmlPath, 'utf8');
const embedded = html.match(/window\.PORTFOLIO_DATA = (\[[\s\S]*?\]);(?=\n\s*const accounts)/);
if (!embedded) throw new Error('Anciennes coordonnées introuvables dans le fichier HTML.');
const reference = JSON.parse(embedded[1]);
const pointsByPostcode = new Map();
for (const item of reference) {
  if (!item.postcode || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
  pointsByPostcode.set(item.postcode, [...(pointsByPostcode.get(item.postcode) || []), item]);
}
const accounts = JSON.parse(readFileSync(dataPath, 'utf8'));
const missing = new Set();
for (const account of accounts) {
  const points = pointsByPostcode.get(account.postcode);
  if (!points?.length) { missing.add(account.postcode); continue; }
  account.latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  account.longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  account.coordinateSource = 'reference';
  account.coordinatePrecision = 'postal_code';
}
writeFileSync(dataPath, JSON.stringify(accounts));
console.log(JSON.stringify({matched: accounts.length - [...missing].reduce((sum, postcode) => sum + accounts.filter(item => item.postcode === postcode).length, 0), missing: [...missing]}));
