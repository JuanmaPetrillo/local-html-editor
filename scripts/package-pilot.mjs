import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseOutRoot(argv) { const i = argv.indexOf('--out-root'); return i >= 0 && argv[i + 1] ? argv[i + 1] : 'pilot-dist'; }
const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const hasV2 = existsSync(path.join(distDir, 'app-v2.bundle.js'));
const hasV1 = existsSync(path.join(distDir, 'src', 'app-shell.mjs'));
if (!existsSync(path.join(distDir, 'index.html')) || (!hasV2 && !hasV1)) throw new Error('run npm run build first');
const outRoot = path.resolve(repoRoot, parseOutRoot(process.argv.slice(2))); mkdirSync(outRoot, { recursive: true });
const outDir = path.join(outRoot, `local-html-editor-pilot-${Date.now()}`); mkdirSync(outDir, { recursive: true });
cpSync(distDir, outDir, { recursive: true });
if (existsSync('tests/fixtures/v2-simple-slide.html')) cpSync('tests/fixtures/v2-simple-slide.html', path.join(outDir, 'sample-slide.html'));
writeFileSync(path.join(outDir, 'PILOT_README.txt'), 'Recommended launch:\n1) Double-click START_HERE.bat\n2) Open http://localhost:8765\n\nNotes:\n- Some browsers block module scripts for file:// URLs.\n- START_HERE.bat helps avoid file:// URLs issues.\n', 'utf8');
writeFileSync(path.join(outDir, 'START_HERE.bat'), '@echo off\r\nset PORT=8765\r\nwhere py >nul 2>nul\r\nif %ERRORLEVEL%==0 (start "" "http://localhost:%PORT%/" && py -m http.server %PORT% && exit /b %ERRORLEVEL%)\r\nwhere python >nul 2>nul\r\nif %ERRORLEVEL%==0 (start "" "http://localhost:%PORT%/" && python -m http.server %PORT% && exit /b %ERRORLEVEL%)\r\nstart "" "index.html"\r\n', 'utf8');
console.log(`Pilot package created: ${outDir}`);
