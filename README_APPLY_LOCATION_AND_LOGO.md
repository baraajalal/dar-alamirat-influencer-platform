# Dar Al Amirat — logo + birth calendar + dynamic city/country options

هذا التعديل مبني فوق Patch إعادة تصميم الواجهات الأخير.

## ما تم تغييره

1. الشعار في الشريط العلوي يستخدم ملف `public/da-logo.png` باللون الأساسي للشعار بدون أي filter أو تحويل للون الأبيض.
2. حقل الميلاد أصبح Date Picker (تقويم). للحفاظ على توافق قاعدة البيانات الحالية، يتم حفظ سنة التاريخ المختار في `birthYear` / `birth_year`.
3. المدينة أصبحت حقلًا بقائمة اقتراحات. إذا لم تكن المدينة موجودة يمكن كتابتها يدويًا، وتُحفظ كخيار مستقبلي.
4. الدولة تبدأ بـ Saudi Arabia، وتحتوي افتراضيًا على دول الخليج: UAE, Kuwait, Bahrain, Qatar, Oman. يمكن كتابة دولة أخرى وحفظها لتظهر لاحقًا.
5. أضيف API داخلي `/api/portal-access/location-options` لقراءة/حفظ الخيارات الجديدة.
6. أضيف rate limit لإضافة خيارات المواقع حتى لا يمكن إساءة استخدام المسار العام.

## SQL مطلوب مرة واحدة

نفّذ الملف التالي في Supabase SQL Editor قبل رفع النسخة:

`supabase/migrations/202608220028_creator_location_options.sql`

## التطبيق

انسخ محتويات الـPatch فوق المشروع الحالي، ثم نفّذ:

```bash
npm run typecheck
npm run build
```

ثم ارفع إلى GitHub.
