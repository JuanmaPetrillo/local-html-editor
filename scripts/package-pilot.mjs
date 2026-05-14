import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseOutRoot(argv) {
  const flagIndex = argv.indexOf('--out-root');
  if (flagIndex === -1) return 'pilot-dist';
  const value = argv[flagIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('Missing value for --out-root');
  }
  return value;
}

function timestamp() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

const repoRoot = process.cwd();
const packageJson = JSON.parse(await import('node:fs/promises').then((m) => m.readFile(path.join(repoRoot, 'package.json'), 'utf8')));
const version = packageJson.version ?? '0.0.0';
const distDir = path.join(repoRoot, 'dist');

const requiredFiles = [
  path.join(distDir, 'index.html'),
  path.join(distDir, 'src', 'app-shell.mjs')
];

for (const filePath of requiredFiles) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required build output: ${path.relative(repoRoot, filePath)}`);
  }
}

const outRoot = path.resolve(repoRoot, parseOutRoot(process.argv.slice(2)));
mkdirSync(outRoot, { recursive: true });

const folderName = `local-html-editor-pilot-v${version}-${timestamp()}`;
const outDir = path.join(outRoot, folderName);
mkdirSync(outDir, { recursive: true });

cpSync(distDir, outDir, { recursive: true });

writeFileSync(
  path.join(outDir, 'PILOT_README.txt'),
  [
    'Local HTML Editor - Manual Pilot Package',
    '',
    'Recommended launch (reliable for module loading):',
    '1) Double-click START_HERE.bat.',
    '2) The script starts a local server and opens http://localhost:8765.',
    '3) In the app, use Open HTML/ZIP to choose a local HTML file.',
    '',
    'Fallback if needed:',
    '- If scripts are blocked, run: py -m http.server 8765',
    '- Or run: python -m http.server 8765',
    '- Then open: http://localhost:8765',
    '',
    'Notes:',
    '- Some browsers/policies block type="module" imports from file:// URLs.',
    '- ZIP is preflight-only in this build.',
    '- No installer/executable is included.'
  ].join('\n'),
  'utf8'
);

writeFileSync(
  path.join(outDir, 'START_HERE.bat'),
  [
    '@echo off',
    'setlocal',
    'set PORT=8765',
    '',
    'where py >nul 2>nul',
    'if %ERRORLEVEL%==0 (',
    '  start "" "http://localhost:%PORT%/"',
    '  py -m http.server %PORT%',
    '  exit /b %ERRORLEVEL%',
    ')',
    '',
    'where python >nul 2>nul',
    'if %ERRORLEVEL%==0 (',
    '  start "" "http://localhost:%PORT%/"',
    '  python -m http.server %PORT%',
    '  exit /b %ERRORLEVEL%',
    ')',
    '',
    'echo Python was not found.',
    'echo Install Python or start a local static server for this folder, then open:',
    'echo http://localhost:%PORT%/',
    'pause'
  ].join('\r\n'),
  'utf8'
);

console.log(`Pilot package created: ${outDir}`);
