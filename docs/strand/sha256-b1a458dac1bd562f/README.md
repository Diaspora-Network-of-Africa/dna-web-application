# Strand export — `sha256-b1a458dac1bd562f` (brief 60-SP: the Strand parts for comments, reactions, tags and reframing; ruling 1699)

Packed 11 October 2026. **Approved and ratified under 1728**, at this export; the extraction's row below was re-read after the ratification line was written into it, and no other file changed. Built on `v1791654208929113`. `export/_ds/` stays at `v1791495246160097`.

**The host exposed no compile id (1727).** Line 1 of the project `_ds_bundle.js` is the `@ds-bundle` manifest header, the bundle is served without a version, and `window.__DS_COMPILE_ID` is unset on a page. This export is identified by the SHA-256 of the bundle body instead, `sha256-` plus its first 16 hex. The body is the project bundle as it stands, with the `ProfileHeader` ResizeObserver fix compiled in.

**Static check for this id:** line 1 of `_ds_bundle.js` reads `/* @ds-compile-id: sha256-b1a458dac1bd562f */`; runtime `window.__DS_COMPILE_ID === 'sha256-b1a458dac1bd562f'`. The body below the three header lines is the project bundle byte for byte (667,313 bytes, SHA-256 `b1a458dac1bd562fa8741288fa41208d5c653e9adff4e238bd3c631f24c83482`). The packed bundle is 667,736 bytes, SHA-256 `6005dba792ecc461775545de23bf314672ea0c4dbfd1ffae7961ac298ee5219b`.

**Proof** (`screenshots/strand-parts-60/readout.html`, against the project bundle at the body SHA-256 above): seven part pages, 12 loads each (light and dark; 390, 820, 1280; touch and pointer), 84 loads. Every load took the project bundle with `__errors` 0 and no page error. The extraction's section 1 has the table.

**New at this id:** items 1 to 21 of brief 60-SP and rulings 1717 to 1719. Tokens: `--weight-semibold` in `tokens/typography.css`, `--sheet-panel-width` and `--sheet-notification-width` in `tokens/spacing.css`, `--c-system-tint` (dark) in `tokens/colors.css`. These three files are copied here with `styles.css`. No icon was added. The extraction lists every prop and token.

Byte counts and SHA-256s read after the copy:

| file | bytes | SHA-256 |
|---|---|---|
| `_ds_bundle.js` | 667,736 | `6005dba792ecc461775545de23bf314672ea0c4dbfd1ffae7961ac298ee5219b` |
| `EXTRACTION-60-STRAND-PARTS.md` | 17,096 | `9aed10cd675d6bf5cc6e7c642c755ebc0550bb82fef89a07bec7a1c457eadb7d` |
| `styles.css` | 196 | `37f87a90806f122fd983671c151210eadad695366c3a5daa1adbdc2b5d8b958f` |
| `tokens/colors.css` | 5,303 | `40ae8cc2cfb9b7e8832303cbe22d6724121db062787abc28ee840d25f214867e` |
| `tokens/typography.css` | 1,113 | `a71820c8976d52d8d24567945fcfa9a91a72cc8a9c2924a35969572d1d5a3fce` |
| `tokens/spacing.css` | 10,053 | `4f1394dc3a5745421a56d7f64589cea282e361aeca4b40f45971150b9c58aa9f` |
