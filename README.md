# Dashboard language activation fix

Copy the `app` and `components` folders over the project root.

Fixes:
- Persists dashboard locale through a server route and cookie.
- Refreshes Server Components after switching language.
- Enables translation inside the LTR dashboard container.
- Removes the Next.js smooth-scroll warning by declaring `data-scroll-behavior="smooth"` on `<html>`.

After copying:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run typecheck
npm run dev
```
