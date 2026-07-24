# Home collaboration order-code update

This patch changes the home-collaboration field from "ملاحظات الطلب" to "كود الطلب".

Apply files to the project, then run:

`supabase/migrations/202607240008_home_order_code.sql`

The migration adds `campaign_assignments.order_code` and updates the existing assignment RPC to store the submitted code in that column. The legacy RPC argument name is retained internally for compatibility.
