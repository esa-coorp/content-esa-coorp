import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = process.argv[2] || 'sites/portefeuille-contribution/examples/Contribution-TGFL-2027-demo.xlsx';
const postcodesSource = 'sites/portefeuille-contribution/dist/assets/france-postcodes.js';
const postcodes = Object.keys(JSON.parse(readFileSync(postcodesSource, 'utf8').replace(/^window\.PORTFOLIO_POSTCODES=/, '').replace(/;\s*$/, '')));
if (!postcodes.length) throw new Error('Référentiel de codes postaux introuvable.');

let seed = 2027;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = values => values[Math.floor(random() * values.length)];
const integer = (min, max) => Math.floor(min + random() * (max - min + 1));
const round = (value, digits = 2) => Number(value.toFixed(digits));
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const columnName = index => { let result = ''; for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result; return result; };
const cell = (column, row, value) => typeof value === 'number' ? `<c r="${columnName(column)}${row}"><v>${value}</v></c>` : `<c r="${columnName(column)}${row}" t="inlineStr"><is><t>${escapeXml(value ?? '')}</t></is></c>`;
const sheetXml = rows => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((values, index) => `<row r="${index + 1}">${values.map((value, column) => cell(column, index + 1, value)).join('')}</row>`).join('')}</sheetData></worksheet>`;

const firstNames = ['Camille', 'Lina', 'Noah', 'Jules', 'Emma', 'Sacha', 'Inès', 'Louis', 'Mila', 'Lucas', 'Chloé', 'Hugo', 'Sarah', 'Nolan', 'Léa', 'Tom'];
const clientTypes = ['BISTRO', 'BRASSERIE', 'RESTAURANT', 'HÔTEL', 'ÉCOLE', 'CLINIQUE', 'CAFÉ', 'TRAITEUR', 'BOULANGERIE', 'CANTINE'];
const cities = ['ATLANTIQUE', 'PROVENCE', 'ALSACE', 'OCCITANIE', 'BRETAGNE', 'SAVOIE', 'NORMANDIE', 'LIMOUSIN', 'AQUITAINE', 'ARDECHE'];
const classes = ['Restauration commerciale', 'Restauration collective', 'Hôtellerie', 'Boulangerie - pâtisserie', 'Santé', 'Éducation', 'Loisirs', 'Entreprise'];
const managers = ['AUBERT Celine', 'THIBAULT Alain', 'LEFRERE Sebastien', 'PESACHOVIC Michael', 'CORMARY Emmanuelle', 'FRAGNOLI Claude', 'TESTAULT Julien', 'MARTIN Laura', 'DUPONT Pierre', 'BERNARD Sonia'];
const tours = ['PARIS CENTRE', 'NORD LITTORAL', 'BRETAGNE SUD', 'NORMANDIE EST', 'GRAND EST', 'ALPES SAVOIE', 'LYON RHÔNE', 'BORDEAUX GIRONDE', 'TOULOUSE OCCITANIE', 'MÉDITERRANÉE', 'NANTES ATLANTIQUE', 'CORSE'];
const clientHeaders = ['Code Client Magellan', 'Nom Commercial Client', 'Nom Classe Activite', 'Code Postal Livraison', 'ONE TEAM ?', 'CA Net', 'Marge net', 'TAUX MARGE', 'Marge€/KG', '€/KG', 'VML', 'PML', 'Contribution (V2)', 'Tx contrib', 'Fréquence liv'];
const baseHeaders = ['Année', 'Mois', 'Nom Responsable de Secteur Dynamique', 'Code Client Magellan', 'Nom Commercial Client', 'Nom Classe Activite', 'Cible TDB', 'Code Postal Livraison', 'Ca Net Recalculé', 'Marge NN Recalculé', 'Poids Brut Facturé', 'Nombre de Client / Date de livraison', 'Montant Contribution (V2)', 'RS TGFL', 'ONE TEAM ?', 'Num tournée', 'Nom tournée', 'Multi ?'];
const clients = Array.from({length: 800}, (_, index) => {
  const clientCode = String(7000000 + index), pricePerKg = round(1.2 + random() * 8, 3), marginRate = round(0.08 + random() * 0.42, 4), revenue = round(1800 + random() * 85000), margin = round(revenue * marginRate), weight = round(revenue / pricePerKg, 1), contributionRate = round(-0.22 + random() * 0.42, 4), contribution = round(revenue * contributionRate), deliveries = integer(2, 28), manager = pick(managers), tourName = pick(tours), tourNumber = `T${String(integer(1, 85)).padStart(2, '0')}`;
  return {clientCode, client: `${pick(clientTypes)} ${pick(cities)} ${String(index + 1).padStart(3, '0')}`, classActivity: pick(classes), postcode: pick(postcodes), oneTeam: random() > 0.72 ? 'OUI' : 'NON', revenue, margin, marginRate, marginPerKg: round(margin / weight, 3), pricePerKg, vml: round(weight * (0.45 + random() * 0.4), 2), pml: round(weight * (0.15 + random() * 0.25), 2), contribution, contributionRate, deliveries: round(deliveries / 12, 2), manager, tourNumber, tourName, weight, annualDeliveries: deliveries};
});
const contribRows = [['Portefeuille Contribution TGFL — données fictives 2027'], [], [], [], clientHeaders, ...clients.map(client => [client.clientCode, client.client, client.classActivity, client.postcode, client.oneTeam, client.revenue, client.margin, client.marginRate, client.marginPerKg, client.pricePerKg, client.vml, client.pml, client.contribution, client.contributionRate, client.deliveries])];
const baseRows = [[], [], ['Base de rapprochement — données fictives 2027'], ['', ...baseHeaders], ...clients.map(client => ['', 2027, integer(1, 12), client.manager, client.clientCode, client.client, client.classActivity, 'RCI', client.postcode, client.revenue, client.margin, client.weight, client.annualDeliveries, client.contribution, client.manager, client.oneTeam, client.tourNumber, client.tourName, 'Unique'])];

const temp = mkdtempSync(join(tmpdir(), 'tgfl-2027-'));
try {
  execFileSync('mkdir', ['-p', join(temp, '_rels'), join(temp, 'xl/_rels'), join(temp, 'xl/worksheets')]);
  writeFileSync(join(temp, '[Content_Types].xml'), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>');
  writeFileSync(join(temp, '_rels/.rels'), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  writeFileSync(join(temp, 'xl/workbook.xml'), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contrib Client" sheetId="1" r:id="rId1"/><sheet name="Base" sheetId="2" r:id="rId2"/></sheets></workbook>');
  writeFileSync(join(temp, 'xl/_rels/workbook.xml.rels'), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
  writeFileSync(join(temp, 'xl/sharedStrings.xml'), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>');
  writeFileSync(join(temp, 'xl/worksheets/sheet1.xml'), sheetXml(contribRows));
  writeFileSync(join(temp, 'xl/worksheets/sheet2.xml'), sheetXml(baseRows));
  const target = join(process.cwd(), output); rmSync(target, {force: true});
  execFileSync('zip', ['-qr', target, '.'], {cwd: temp});
  console.log(JSON.stringify({output, clients: clients.length, postcodes: new Set(clients.map(client => client.postcode)).size}));
} finally { rmSync(temp, {recursive: true, force: true}); }
