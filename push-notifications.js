/* RIBACOM opt-in phone notification setup. Push sending requires VAPID server configuration. */
(function () {
  const b64ToBytes = value => {
    const pad = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
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
})();