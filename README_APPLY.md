# تحديث V4 — ملف المؤثر وبوابة المستخدم

## التطبيق
1. خذ نسخة احتياطية من المشروع.
2. انسخ محتويات هذا المجلد فوق جذر المشروع، ثم وافق على استبدال الملفات.
3. في Supabase SQL Editor شغّل:
   `supabase/migrations/202607220004_profile_completion_portal_access.sql`
4. تأكد أن `.env.local` يحتوي:
   `NEXT_PUBLIC_APP_URL=http://localhost:3000`
5. في Supabase افتح Authentication > URL Configuration وأضف إلى Redirect URLs:
   `http://localhost:3000/auth/callback`
   وأضف رابط الإنتاج نفسه لاحقًا.
6. شغّل:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run dev`

## المسارات الجديدة
- `/portal-access`: طلب تفعيل حساب مؤثر أو الانتقال لتسجيل الدخول.
- `/dashboard/access-requests`: قائمة طلبات التفعيل للموظفين؛ المدير يستطيع إرسال الدعوة أو الرفض.
- `/auth/callback`: استقبال رابط دعوة Supabase.
- `/set-password`: إنشاء كلمة مرور الدعوة.
- `/influencer/dashboard`: الحملات والمستحقات والبيانات المالية بعد تسجيل الدخول.

## اختبار سريع
1. ابحث عن رقم موجود وتأكد من رجوع التفضيلات والمنصات.
2. عدّل حساب تواصل واضغط الحفظ النهائي دون ضغط حفظ تعديل الحساب؛ يجب حفظ آخر قيمة.
3. افتح `/portal-access` وأرسل طلب تفعيل.
4. من حساب Admin افتح `/dashboard/access-requests` واضغط إرسال الدعوة.
5. افتح الدعوة من البريد، أنشئ كلمة مرور، وتأكد من الانتقال إلى `/influencer/dashboard`.
