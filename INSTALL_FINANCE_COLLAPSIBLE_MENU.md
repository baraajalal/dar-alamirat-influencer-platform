# Finance collapsible sidebar menu

1. Copy `components/dashboard/sidebar.tsx` into the project root, replacing the existing file.
2. Run:

```cmd
rmdir /s /q .next
npm run typecheck
npx eslint . --quiet
npm run dev
```

Result:
- `Payments & Compensation` is the only top-level finance item.
- Financial Approvals, Financial Transfers, Electronic Vouchers, and Financial Reports appear inside its collapsible submenu.
- The submenu opens automatically when the user is on any `/dashboard/finance/...` page.
