# Beta 5.2.2 — Hydration & Dynamic Data Guard

This hotfix permanently disables DOM text translation by the legacy GlobalTranslator.

## Root cause fixed
The legacy translator performed substring replacement across `document.body` and watched
new nodes with `MutationObserver`. In Next.js 16 streaming hydration, that can mutate a
server-rendered node before its nested hydration boundary completes. It can also corrupt
database values; for example the Arabic fragment `لا` inside the creator name `علا` was
translated to `No`, resulting in `عNo`.

## New rule
- UI copy is translated only through Arabic/English dictionaries.
- Creator names, campaign names, brand names, usernames, links, notes and other stored data
  are never machine-rewritten in the DOM.
- `GlobalTranslator` is now only a compatibility shell that synchronizes `lang`, `dir` and
  `data-locale` on the document element.
- `i18n:audit` now fails if DOM-walking/mutation translation is reintroduced.

No database migration is required.
