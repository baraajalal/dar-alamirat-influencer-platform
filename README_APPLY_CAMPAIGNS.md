# تحديث إدارة الحملات - المرحلة الأولى

## الملفات المضافة أو المعدلة

- `supabase/migrations/202607220005_campaign_management.sql`
- `app/dashboard/page.tsx`
- `app/dashboard/campaigns/page.tsx`
- `app/dashboard/campaigns/actions.ts`
- `app/dashboard/campaigns/new/page.tsx`
- `app/dashboard/campaigns/new/campaign-form.tsx`
- `app/dashboard/campaigns/[id]/page.tsx`

## التنفيذ

1. انسخ محتويات الحزمة إلى جذر المشروع ووافق على استبدال الملفات.
2. شغّل ملف SQL في Supabase SQL Editor مرة واحدة.
3. شغّل:

```cmd
npm run typecheck
npm run lint
npm run dev
```

4. افتح:

- `/dashboard`
- `/dashboard/campaigns`
- `/dashboard/campaigns/new`

## ما تنفذه هذه المرحلة

- إضافة الحقول الناقصة إلى جدول الحملات دون إنشاء جداول مكررة.
- قائمة حملات مع بحث وفلاتر وإحصاءات.
- إنشاء حملة وحفظها الحقيقي في Supabase.
- صفحة تفاصيل أولية للحملة.
- إضافة الحملات إلى لوحة الإدارة.

## غير مشمول بعد

- ربط المؤثر بالحملة.
- تحديد المنصات والمحتوى والمقابل.
- تعديل أو حذف الحملة من الواجهة.
