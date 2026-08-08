# إصلاح مبلغ التحويل المالي

## السبب

حقول PostgreSQL الرقمية قد تصل إلى Next.js كنص مثل `"0"`. في JavaScript النص `"0"` يعتبر قيمة صحيحة، لذلك التعبير القديم:

```ts
payment.expected_amount || payment.amount
```

كان يختار `"0"` ولا ينتقل إلى مبلغ المقابل الصحيح.

## الملفات المعدلة

- `app/dashboard/finance/transfers/page.tsx`
- `app/dashboard/finance/transfers/actions.ts`
- `app/dashboard/finance/reports/page.tsx`
- `supabase/migrations/202608020016_finance_transfer_amount_fallback.sql`

## التركيب

1. انسخ محتويات الحزمة إلى جذر المشروع ووافق على الاستبدال.
2. شغّل Migration رقم `016` في Supabase SQL Editor.
3. نفّذ:

```cmd
rmdir /s /q .next
npm run typecheck
npx eslint . --quiet
npm run dev
```

## النتيجة

يتم اختيار المبلغ بهذا الترتيب:

1. `payments.expected_amount` إذا كان أكبر من صفر.
2. `payments.amount` إذا كان أكبر من صفر.
3. `assignment_compensations.amount` كمرجع نهائي.
4. يطرح منه `paid_amount` لإظهار المتبقي الفعلي.

المبلغ نفسه يحفظ كنسخة ثابتة داخل عنصر مجموعة التحويل عند إنشاء المسودة.
