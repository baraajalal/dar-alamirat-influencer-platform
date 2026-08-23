# Field-level validation feedback patch

يضيف هذا التعديل أخطاء دقيقة على مستوى الحقول في نموذج تسجيل صانع المحتوى:

- Popup يذكر اسم الحقل الذي يحتوي المشكلة والسبب.
- ينتقل تلقائياً إلى الخطوة التي تحتوي الحقل.
- يعمل Scroll للحقل ويضع التركيز عليه.
- الحقل الخاطئ يظهر بإطار أحمر وHover/Focus أحمر مع رسالة أسفله.
- يختفي التنبيه الأحمر فور تعديل الحقل.
- API يعيد `issues` بمسارات الحقول بدلاً من رسالة عامة فقط.
- رقم الجوال يُتحقق منه قبل الإرسال ويقبل الصيغ السعودية الشائعة.

## الملفات
- components/influencer-onboarding-wizard.tsx
- app/api/submit-influencer/route.ts
- app/api/portal-access/edit/route.ts
- lib/influencers/registration.ts

لا يحتاج SQL أو Migration جديد.
