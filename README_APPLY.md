# Portal activation build fix

هذا التعديل يعالج خطأ Next.js 16 أثناء build:

`useSearchParams() should be wrapped in a suspense boundary at page "/portal/access/activate"`

## ما تغير

- أزيل `useSearchParams()` بالكامل من Client Component.
- `page.tsx` أصبح Server Component ويقرأ `searchParams` من Next.js مباشرة.
- منطق التفعيل الكامل انتقل إلى `activate-client.tsx` مع تمرير `token` كـ prop.
- تم الاحتفاظ برسائل النجاح والخطأ Popup وإغلاق رابط التفعيل بعد النجاح.

## التطبيق

انسخ مجلدي `app` و`components` فوق المشروع الحالي ثم شغّل:

```bash
npm run build
```

إذا نجح:

```bash
git add .
git commit -m "Fix portal activation production build"
git push origin main
```
