تعديل تسجيل دخول الموظفين المنفصل

المسارات الجديدة:
/staff/login
/staff/set-password

رابط دعوة الموظف:
/auth/callback?account_type=staff&next=/staff/set-password

لا يوجد ملف SQL جديد. يجب تشغيل Migration المستخدمين السابق:
202608040026_staff_users_and_invitations.sql

أضف في Supabase Redirect URLs:
http://localhost:3000/auth/callback
ورابط الإنتاج المقابل.
