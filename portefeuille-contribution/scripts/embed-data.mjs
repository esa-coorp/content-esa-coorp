import { readFileSync, writeFileSync } from 'node:fs';

const [templatePath, dataPath] = process.argv.slice(2);
if (!templatePath || !dataPath) throw new Error('Usage: node embed-data.mjs <html> <data.json>');

const html = readFileSync(templatePath, 'utf8');
const data = readFileSync(dataPath, 'utf8');
const assignment = `window.PORTFOLIO_DATA = ${data};`;
const marker = '/* DATA_EMBEDDED */';
const output = html.includes(marker)
  ? html.replace(marker, assignment)
  : html.replace(/window\.PORTFOLIO_DATA = \[[\s\S]*?\];(?=\n\s*const accounts)/, assignment);

if (output === html) throw new Error('Data insertion point not found.');
writeFileSync(templatePath, output);
