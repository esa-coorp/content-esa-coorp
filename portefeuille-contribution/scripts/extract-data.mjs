import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node extract-data.mjs <source.xlsx> <output.json>');
const extract = member => execFileSync('unzip', ['-p', source, member], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replace(/&#(x[\dA-F]+|\d+);/gi, (_, item) => String.fromCodePoint(item[0].toLowerCase() === 'x' ? Number.parseInt(item.slice(1), 16) : Number(item)));
const headerName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const code = value => { const result = String(value ?? '').trim().replace(/\.0+$/, '').replace(/\s+/g, ''); return /^(\(vide\)|n\/a|-)?$/i.test(result) ? '' : result; };
const postcode = value => { const digits = String(value ?? '').replace(/\.0+$/, '').replace(/\D/g, ''); return digits ? digits.padStart(5, '0').slice(-5) : ''; };
const amount = value => { const parsed = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; };
const month = value => {
  const numeric = amount(value); if (numeric >= 1 && numeric <= 12) return numeric;
  const normalized = headerName(value), names = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const named = names.indexOf(normalized); if (named >= 0) return named + 1;
  const match = normalized.match(/(?:^| )m?0?([1-9]|1[0-2])(?: |$)/);
  return match ? Number(match[1]) : 0;
};
const string = value => String(value ?? '').trim();

const shared = [...extract('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => decode([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(part => part[1]).join('')));
const workbook = extract('xl/workbook.xml');
const rels = extract('xl/_rels/workbook.xml.rels');
const targets = new Map([...rels.matchAll(/<Relationship\s+([^>]*)\/>/g)].map(match => [(match[1].match(/Id="([^"]+)"/) || [])[1], `xl/${(match[1].match(/Target="([^"]+)"/) || [])[1]}`]));
const sheets = new Map([...workbook.matchAll(/<sheet\s+([^>]*)\/>/g)].map(match => [(match[1].match(/name="([^"]+)"/) || [])[1], targets.get((match[1].match(/r:id="([^"]+)"/) || [])[1]) ]));
const readSheet = name => {
  const path = sheets.get(name); if (!path) throw new Error(`Feuille introuvable : ${name}`);
  return [...extract(path).matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(match => {
    const row = {number: Number(match[1])};
    for (const cell of match[2].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
      const column = (cell[1].match(/r="([A-Z]+)\d+"/) || [])[1]; const type = (cell[1].match(/t="([^"\s]+)"/) || [])[1];
      const raw = (cell[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1] || ''; const inline = [...cell[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(part => part[1]).join('');
      if (column) row[column] = type === 's' ? shared[Number(raw)] : decode(type === 'inlineStr' ? inline : raw);
    }
    return row;
  });
};
const header = (rows, required) => {
  const row = rows.find(item => { const values = new Set(Object.entries(item).filter(([key]) => key !== 'number').map(([, value]) => headerName(value))); return required.every(label => values.has(headerName(label))); });
  if (!row) throw new Error(`En-têtes introuvables : ${required.join(', ')}`);
  return {row, columns: Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'number').map(([column, value]) => [headerName(value), column]))};
};
const clients = readSheet('Contrib Client'); const base = readSheet('Base');
const clientHeader = header(clients, ['Code Client Magellan', 'Nom Commercial Client', 'CA Net', 'Contribution (V2)']);
const baseHeader = header(base, ['Code Client Magellan', 'RS TGFL']);
const clientColumn = label => clientHeader.columns[headerName(label)]; const baseColumn = label => baseHeader.columns[headerName(label)];
const baseByClient = new Map();
for (const row of base.filter(item => item.number > baseHeader.row.number)) {
  const clientCode = code(row[baseColumn('Code Client Magellan')]); if (!clientCode) continue;
  const assignment = {
    rsd: string(row[baseColumn('RS TGFL')]),
    periodYear: amount(row[baseColumn('Année')]),
    periodMonth: month(row[baseColumn('Mois')]),
    tourNumber: string(row[baseColumn('Num tournée')]),
    tourName: string(row[baseColumn('Nom tournée')]),
    caNetRecalculated: amount(row[baseColumn('Ca Net Recalculé')]),
    marginNnRecalculated: amount(row[baseColumn('Marge NN Recalculé')]),
    invoicedWeight: amount(row[baseColumn('Poids Brut Facturé')]),
    clientsPerDelivery: amount(row[baseColumn('Nombre de Client / Date de livraison')]),
    contributionAmountV2: amount(row[baseColumn('Montant Contribution (V2)')])
  };
  if (!assignment.rsd && !assignment.tourNumber && !assignment.tourName) continue;
  const values = baseByClient.get(clientCode) || new Map(); values.set(JSON.stringify(assignment), assignment); baseByClient.set(clientCode, values);
}
const anomalies = {unmatchedClientCodes: [], ambiguousAssignments: [], aggregatedBaseRows: [], duplicateSourceClientCodes: []}; const sourceByClient = new Map();
for (const row of clients.filter(item => item.number > clientHeader.row.number)) {
  const clientCode = code(row[clientColumn('Code Client Magellan')]); const client = string(row[clientColumn('Nom Commercial Client')]); if (!clientCode || !client) continue;
  const item = {clientCode, client, classActivity: string(row[clientColumn('Nom Classe Activite')]) || 'Non renseignée', postcode: postcode(row[clientColumn('Code Postal Livraison')]), oneTeam: string(row[clientColumn('ONE TEAM ?')]), revenue: amount(row[clientColumn('CA Net')]), margin: amount(row[clientColumn('Marge net')]), marginRate: amount(row[clientColumn('TAUX MARGE')]), marginPerKg: amount(row[clientColumn('Marge€/KG')]), pricePerKg: amount(row[clientColumn('€/KG')]), vml: amount(row[clientColumn('VML')]), pml: amount(row[clientColumn('PML')]), contribution: amount(row[clientColumn('Contribution (V2)')]), contributionV2: amount(row[clientColumn('Contribution (V2)')]), contributionRate: amount(row[clientColumn('Tx contrib')]), deliveries: amount(row[clientColumn('Fréquence liv')])};
  const matches = [...(baseByClient.get(clientCode)?.values() || [])];
  const assignments = [...new Map(matches.map(match => [JSON.stringify({rsd: match.rsd, tourNumber: match.tourNumber, tourName: match.tourName}), match])).values()];
  if (!matches.length) { Object.assign(item, {rsd: 'Non affecté', tourNumber: '', tourName: '', periodYears: [], periodMonths: [], caNetRecalculated: null, marginNnRecalculated: null, invoicedWeight: null, clientsPerDelivery: null, contributionAmountV2: null}); anomalies.unmatchedClientCodes.push(clientCode); }
  else if (assignments.length > 1) { Object.assign(item, {rsd: 'Affectation multiple', tourNumber: 'Multiple', tourName: 'Affectation à valider', assignments, periodYears: [...new Set(matches.map(match => match.periodYear).filter(Boolean))], periodMonths: [...new Set(matches.map(match => match.periodMonth).filter(Boolean))], caNetRecalculated: null, marginNnRecalculated: null, invoicedWeight: null, clientsPerDelivery: null, contributionAmountV2: null}); anomalies.ambiguousAssignments.push({clientCode, assignments}); }
  else {
    const metrics = ['caNetRecalculated', 'marginNnRecalculated', 'invoicedWeight', 'clientsPerDelivery', 'contributionAmountV2'];
    Object.assign(item, assignments[0]);
    item.periodYears = [...new Set(matches.map(match => match.periodYear).filter(Boolean))]; item.periodMonths = [...new Set(matches.map(match => match.periodMonth).filter(Boolean))];
    metrics.forEach(key => { item[key] = matches.reduce((total, match) => total + match[key], 0); });
    if (matches.length > 1) anomalies.aggregatedBaseRows.push({clientCode, rows: matches.length});
  }
  const items = sourceByClient.get(clientCode) || []; items.push(item); sourceByClient.set(clientCode, items);
}
const accounts = [...sourceByClient.values()].map(items => {
  if (items.length === 1) return items[0];
  anomalies.duplicateSourceClientCodes.push({clientCode: items[0].clientCode, rows: items.length}); const aggregate = {...items[0]};
  for (const key of ['revenue', 'margin', 'vml', 'pml', 'contribution', 'contributionV2', 'deliveries']) aggregate[key] = items.reduce((total, item) => total + item[key], 0);
  aggregate.marginRate = aggregate.revenue ? aggregate.margin / aggregate.revenue : 0; aggregate.contributionRate = aggregate.revenue ? aggregate.contribution / aggregate.revenue : 0; return aggregate;
});
const previous = (() => { try { return JSON.parse(readFileSync(output, 'utf8')); } catch { return []; } })();
const coordinates = new Map(previous.filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).map(item => [item.postcode, item]));
for (const account of accounts) {
  const point = coordinates.get(account.postcode);
  if (point) Object.assign(account, {latitude: point.latitude, longitude: point.longitude, coordinateSource: point.coordinateSource, coordinatePrecision: point.coordinatePrecision});
}
writeFileSync(output, JSON.stringify(accounts)); writeFileSync(output.replace(/\.json$/i, '.anomalies.json'), JSON.stringify(anomalies, null, 2));
console.log(JSON.stringify({sourceRows: [...sourceByClient.values()].reduce((total, items) => total + items.length, 0), accounts: accounts.length, sourceDuplicates: anomalies.duplicateSourceClientCodes.length, unmatched: anomalies.unmatchedClientCodes.length, ambiguousAssignments: anomalies.ambiguousAssignments.length, aggregatedBaseRows: anomalies.aggregatedBaseRows.length, rsd: new Set(accounts.map(account => account.rsd)).size}, null, 2));
