# Test Plan

## Test categories

1. Unit tests
2. Import/export integration tests
3. Editor interaction tests
4. Security regression tests
5. Accessibility tests
6. Packaged app smoke tests
7. Manual pilot tests

## Synthetic fixture set

Create fixtures under `tests/fixtures/`:

```text
tests/fixtures/
  simple-single-file/
  local-assets/
  long-text-overflow/
  absolute-positioned-elements/
  css-transform-elements/
  simple-js-interaction/
  remote-assets-blocked/
  malicious-network/
  malicious-local-file/
  malformed-html/
```

## Unit test examples

- manifest schema validation
- remote URL detection
- token uniqueness
- asset path normalization
- exported path rewrite
- editable operation validation
- patch application
- undo/redo reducer

## E2E test examples

- open simple deck
- edit title text
- replace image
- move image
- resize image
- keyboard nudge
- undo/redo all operations
- export ZIP
- reopen export

## Security test examples

- imported HTML calls `fetch('https://example.com')`
- imported HTML creates `new WebSocket(...)`
- imported HTML loads remote image pixel
- imported HTML attempts to access app bridge
- imported HTML attempts top-level navigation
- imported HTML includes form submit

Expected result: blocked or inert in safe mode.

## Packaged smoke test

On a clean normal-user Windows account:

- install/run app
- open fixture deck
- make simple edit
- export
- reopen export
- uninstall/delete app

No admin prompts should appear.
