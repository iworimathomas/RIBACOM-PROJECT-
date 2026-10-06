RIBACOM FINAL MODULAR RELEASE — D9

Official identity:
Rivers Bayelsa Community in Diaspora The Gambia (RIBACOM)
Display name: RIVERS BAYELSA COMMUNITY THE GAMBIA (RIBACOM)
Motto: TRUTH • UNITY • SERVICE

D9 FINAL RELEASE
This package is the final modular release candidate produced from the verified D8 build.
Supabase is the authoritative backend and Supabase Auth is the authentication/session authority.
Only the browser-safe Supabase publishable key is included. No service-role or secret key is included.

MODULES
- index.html — application shell and navigation
- css/style.css — main styling
- css/digital-id.css — Digital ID and print styling
- js/config.js — fixed RIBACOM/Supabase configuration
- js/app.js — application shell, routing, Supabase data loading and public/member UI
- js/auth.js — authentication bridge
- js/members.js — membership workflow
- js/digital-id.js — Digital ID lifecycle
- js/leadership.js — leadership extension hook
- js/constitution.js — constitution management
- js/content.js — content extension hook
- js/welfare.js — welfare workflow
- js/admin.js — administration helpers
- js/d5-admin.js — About/Gallery administration extensions
- js/d7-admin.js — complete administration control centre
- js/system.js — system verification

SECURITY
- Do not add a service-role key to this project.
- Database access is controlled by Supabase RLS policies.
- Admin operations require an authenticated admin/super_admin profile.
- Public content is read according to the existing RLS policies.
- Member data is restricted by the existing member policies.

IMPORTANT
- There are no demo credentials.
- There is no demo database.
- There is no LocalStorage database fallback.
- The small in-memory object in app.js is only a UI cache/default shape; cloud data is loaded from Supabase.
- Do not publish unverified constitution text over the authoritative 13-Chapter/97-Article source.
- Do not add a fixed registered office address unless the community formally supplies one.
- The approved official RIBACOM crest is stored as `ribacom-official-logo.jpg` and is used by the main application branding.

DEPLOYMENT
1. Upload the contents of this package to the RIBACOM GitHub repository.
2. Keep the folder structure unchanged.
3. Open index.html through GitHub Pages or another static host.
4. Use the real RIBACOM Supabase account credentials for login.
5. Run the Admin > System Verification page after deployment.

VALIDATION
The D9 JavaScript source was syntax-checked with Node.js.
The release archive was integrity-tested before delivery.
Live browser-to-Supabase testing was not claimed where the execution environment could not establish the external browser connection.
