Dar Al Amirat beta.7.1.1 - Influencer Name Import Hotfix

Fixes archive import so the following Excel columns are sent to the unified directory importer:
- Influencer Name
- Influencer Email
- City
- Bio
- Category
- Username
- Profile URL
- Followers

Safe re-import behavior:
- Existing influencer is matched by normalized mobile.
- Missing/generated profile name is filled from Influencer Name.
- Existing work is deduplicated by the database importer.
- No database migration is included in this hotfix; it expects Phase 07.1 migration to already be applied.
