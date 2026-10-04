// RIBACOM authentication bridge. Supabase Auth is the sole session authority.
window.RIBACOM_AUTH = {
  getUser: () => window.app?.currentUser || null,
  clear: () => { if (window.app) window.app.currentUser = null; }
};
