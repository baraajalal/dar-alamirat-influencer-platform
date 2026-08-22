# Multiple Collaboration Patch

هذا التعديل يضيف خيار **تعاونات متعددة** في إضافة صانع محتوى للحملة، بحيث يمكن دمج التعاون المنزلي والحضوري داخل نفس التكليف.

## ما تغير
- إضافة خيار: تعاونات متعددة / Combined collaboration.
- عند اختياره تظهر معًا:
  - رقم الطلب.
  - كود الطلب.
  - قيمة الطلب.
  - الفرع.
  - تاريخ ووقت الحضور.
- المقابل المالي للتعاون المدمج يبقى في خطوة المقابل والدفع التالية، حتى لا يتكرر السعر في أكثر من مكان.
- إخفاء موعد تسليم المحتوى وموعد النشر من نموذج إنشاء التكليف.
- التكليفات الجديدة تحفظ هذين الموعدين كـ NULL حاليًا.
- إزالة موعد التسليم والنشر من رسالة دعوة واتساب.
- عرض التعاون المدمج لاحقًا باسم: تعاون منزلي + حضوري.

## التوافق مع قاعدة البيانات الحالية
لا يحتاج SQL أو Migration جديد. لأجل التوافق مع بنية `execution_type` الحالية، التعاون المتعدد يُخزن تقنيًا كـ `remote` مع marker داخلي `MULTIPLE_HOME_IN_BRANCH`، بينما تبقى حقول الطلب والفرع والحضور محفوظة في نفس سجل التكليف.

## الملفات المعدلة
- app/dashboard/campaigns/[id]/influencers/add/assignment-form.tsx
- app/dashboard/campaigns/[id]/influencers/add/actions.ts
- app/dashboard/campaigns/assignments/actions.ts
- app/dashboard/campaigns/[id]/influencers/[assignmentId]/page.tsx
- app/portal/assignments/[token]/guest-assignment-client.tsx
- app/portal/(account)/campaigns/page.tsx
