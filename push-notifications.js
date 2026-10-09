/* RIBACOM opt-in phone notification setup. Push sending requires VAPID server configuration. */
(function () {
  const b64ToBytes = value => {
    const pad = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  };
  const originalRenderNotifications = RibacomApp.prototype.renderNotifications;
  RibacomApp.prototype.renderNotifications = async function () {
    const html = await originalRenderNotifications.call(this);
    if (!this.currentUser || !html.includes('Notifications')) return html;
    const panel = '<div class="bg-white rounded-2xl border p-4"><h3 class="font-bold text-ribacom-navy">Phone alerts</h3><p class="text-sm text-gray-600 mt-1">Choose whether this device can receive RIBACOM alerts.</p><div class="flex flex-wrap gap-2 mt-3"><button onclick="app.enablePhoneNotifications()" class="bg-ribacom-green text-white rounded-xl px-4 py-2 text-xs font-bold">Enable phone alerts</button><button onclick="app.disablePhoneNotifications()" class="border rounded-xl px-4 py-2 text-xs font-bold">Disable on this device</button></div></div>';
    return html.replace('</div><div class="space-y-3">', '</div>' + panel + '<div class="space-y-3">');
  };
  RibacomApp.prototype.enablePhoneNotifications = async function () {
    const client = this.supabaseClient;
    const user = this.currentUser;
    if (!user || !user.id || !client) return this.toast('Please sign in first.', 'warning');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return this.toast('Phone push notifications are not supported by this browser. Try an up-to-date browser; on iPhone, add RIBACOM to the Home Screen first.', 'warning');
    }
    const publicKey = window.RIBACOM_CONFIG && window.RIBACOM_CONFIG.pushVapidPublicKey;
    if (!publicKey) return this.toast('Phone alerts are not activated yet: the secure VAPID public key and server keys must be configured first. Your in-app notifications remain available.', 'warning');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return this.toast('Phone notification permission was not granted.', 'warning');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const json = subscription.toJSON();
      const { error } = await client.from('push_subscriptions').upsert({
        user_id: user.id, endpoint: json.endpoint, p256dh: json.keys && json.keys.p256dh,
        auth_key: json.keys && json.keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;
      this.toast('This device is registered for RIBACOM phone alerts. Delivery will begin after server-side push sending is activated.', 'success');
    } catch (err) {
      console.error('RIBACOM phone notifications:', err);
      this.toast('Could not register this device: ' + (err.message || 'please try again'), 'error');
    }
  };
  RibacomApp.prototype.disablePhoneNotifications = async function () {
    const client = this.supabaseClient, user = this.currentUser;
    if (!user || !client || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        await client.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      this.toast('Phone alerts disabled on this device.', 'success');
    } catch (err) { this.toast('Could not disable phone alerts: ' + (err.message || 'please try again'), 'error'); }
  };
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(err => console.warn('RIBACOM service worker:', err)));
  }

  // Keep the signed-in member aware of new in-app notifications while using RIBACOM.
  // The database remains the source of truth; this polling does not mark anything read.
  let watchedUserId = null;
  let knownNotificationIds = new Set();
  let notificationPollBusy = false;
  async function pollMemberNotifications() {
    const instance = window.app;
    if (!instance || !instance.currentUser || !instance.currentUser.id || !instance.supabaseClient) {
      watchedUserId = null;
      knownNotificationIds = new Set();
      return;
    }
    if (notificationPollBusy) return;
    notificationPollBusy = true;
    try {
      const userId = instance.currentUser.id;
      const { data, error } = await instance.supabaseClient
        .from('notifications').select('id,title,message,type,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      if (error || !Array.isArray(data)) return;
      if (watchedUserId !== userId) {
        watchedUserId = userId;
        knownNotificationIds = new Set(data.map(row => row.id));
        return;
      }
      const fresh = data.filter(row => row.id && !knownNotificationIds.has(row.id));
      data.forEach(row => knownNotificationIds.add(row.id));
      fresh.reverse().forEach(row => {
        if (typeof instance.toast === 'function') {
          instance.toast((row.title || 'RIBACOM notification') + (row.message ? ': ' + row.message : ''), 'info');
        }
        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
          try { new Notification(row.title || 'RIBACOM Update', { body: row.message || 'There is a new RIBACOM notification.', icon: '/ribacom-official-logo.svg' }); } catch (_) {}
        }
      });
      if (knownNotificationIds.size > 100) knownNotificationIds = new Set(data.map(row => row.id));
    } catch (err) {
      console.warn('RIBACOM notification refresh:', err);
    } finally {
      notificationPollBusy = false;
    }
  }
  window.setInterval(pollMemberNotifications, 45000);
  window.addEventListener('focus', pollMemberNotifications);
  window.addEventListener('load', () => window.setTimeout(pollMemberNotifications, 5000));

})();