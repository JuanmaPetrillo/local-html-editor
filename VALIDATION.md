# Validation

This file defines the active validation gate for the current repository state.

## Current gate

The following scripts are active local scripts and are the current validation gate:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:security
npm run build
```

## CI note

GitHub Actions CI may be temporarily unavailable (for example, Actions quota limits). When CI is unavailable, local validation runs are the required gate.
