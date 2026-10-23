import { readFileSync, writeFileSync } from 'node:fs';

const dataPath = process.argv[2];
if (!dataPath) throw new Error('Usage: node apply-address-overrides.mjs <data.json>');

// Public addresses checked individually; coordinates are from Nominatim / OpenStreetMap.
const overrides = {
  '60808458': { latitude: 48.8204567, longitude: 1.7968200, address: '9 rue Montbuzy, 78490 Boissy-sans-Avoir' },
  '60800775': { latitude: 48.6861974, longitude: 2.1942864, address: '4 avenue du Canada, 91940 Les Ulis' },
  '60806428': { latitude: 48.6033570, longitude: 2.4424670, address: '146 route de Corbeil, 91090 Lisses' },
  '60806466': { latitude: 48.9450554, longitude: 2.2590368, address: '55 rue de la Voie des Bans, 95100 Argenteuil' },
  '60848322': { latitude: 48.8961806, longitude: 2.2980448, address: '2 place du 8-Mai-1945, 92300 Levallois-Perret' },
  '60851673': { latitude: 48.8370780, longitude: 2.6359630, address: 'Lognes, 77185', precision: 'postal_code_confirmed', source: 'ban' }
};

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
let updated = 0;
for (const account of data) {
  const override = overrides[account.clientCode];
  if (!override) continue;
  Object.assign(account, override, { coordinateSource: override.source || 'nominatim', coordinatePrecision: override.precision || 'exact_address' });
  updated += 1;
}
writeFileSync(dataPath, JSON.stringify(data));
console.log(JSON.stringify({ updated, unresolved: data.filter((account) => !Number.isFinite(account.latitude) || !Number.isFinite(account.longitude)).map((account) => ({ code: account.clientCode, client: account.client, postcode: account.postcode })) }));
