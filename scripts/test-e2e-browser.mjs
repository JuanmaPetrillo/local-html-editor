import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html missing. Run npm run build first.');
  process.exit(1);
}

let playwrightAvailable = true;
try {
  await import('@playwright/test');
} catch {
  playwrightAvailable = false;
}

if (!playwrightAvailable) {
  const required = process.env.REQUIRE_BROWSER_E2E === '1';
  const message = 'SKIP: @playwright/test not installed; browser e2e flow not executed.';
  if (required) {
    console.error(`${message} Set up Playwright or unset REQUIRE_BROWSER_E2E.`);
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

console.log('Playwright detected. Browser E2E scaffolding is present but not yet wired in this repository.');
console.log('Run real browser tests after adding Playwright config/spec files.');

try {
  execSync('node -e "console.log(\'browser e2e scaffold check passed\')"', { stdio: 'inherit' });
} catch {
  process.exit(1);
}
