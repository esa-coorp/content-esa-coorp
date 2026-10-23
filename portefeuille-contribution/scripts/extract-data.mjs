import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
const output = process.argv[3];
if (!source || !output) throw new Error('Usage: node extract-data.mjs <source.xlsx> <output.json>');

const extract = (member) => execFileSync('unzip', ['-p', source, member], { encoding: 'utf8' });
const decode = (text) => text
  .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
const shared = [...extract('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
  .map((match) => decode([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join('')));
const rows = [...extract('xl/worksheets/sheet1.xml').matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
  .map((match) => {
    const row = { number: Number(match[1]) };
    for (const cell of match[2].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
      const column = (cell[1].match(/r="([A-Z]+)\d+"/) || [])[1];
      const type = (cell[1].match(/t="(\w+)"/) || [])[1];
      const raw = (cell[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
      if (column) row[column] = type === 's' ? shared[Number(raw)] : raw;
    }
    return row;
  });

const accounts = rows
  .filter((row) => row.number >= 5 && row.D && row.E && row.H)
  .map((row) => ({
    rsd: row.D.trim(),
    clientCode: row.E.trim(),
    client: row.F?.trim() || 'Compte sans libellé',
    target: row.G?.trim() || 'Non renseigné',
    postcode: row.H.trim().padStart(5, '0'),
    revenue: Number(row.I || 0),
    margin: Number(row.J || 0),
    contributionV2: Number(row.K || 0),
    deliveries: Number(row.L || 0),
    weight: Number(row.M || 0),
    lines: Number(row.N || 0),
    impactTransport: Number(row.R || 0),
    impactWeight: Number(row.S || 0),
    impactInvoiceLines: Number(row.T || 0),
    impactOrderLines: Number(row.U || 0),
    contribution: Number(row.V || 0),
    delta: Number(row.W || 0)
  }));

writeFileSync(output, JSON.stringify(accounts));
console.log(JSON.stringify({ accounts: accounts.length, rsd: new Set(accounts.map((row) => row.rsd)).size }));
