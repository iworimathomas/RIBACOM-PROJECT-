# RIBACOM Phone Push Notifications — Setup

Phone push delivery is not active until VAPID secrets are configured in Supabase.

## 1. Generate a VAPID key pair
Use a trusted local environment with Node.js and the `web-push` package. Do not paste the private key into GitHub, the website, chat, or client-side configuration.

```bash
npx web-push generate-vapid-keys
```

Keep both generated values private while configuring them. The public key is intended for the browser; the private key must remain server-side.

## 2. Add Supabase Edge Function secrets
In the Supabase Dashboard for project `pvgdcqzglafkhqvzxxbi`, open Edge Functions / Secrets and add:

- `VAPID_PUBLIC_KEY` — generated public key
- `VAPID_PRIVATE_KEY` — generated private key
- `VAPID_SUBJECT` — a valid contact URI such as `mailto:admin@ribacomgambia.org`

Do not add the private key to `config.js`, any frontend file, or GitHub.

## 3. Add the matching public key to the website
In `config.js`, add this property inside `window.RIBACOM_CONFIG`:

```js
pushVapidPublicKey: 'PASTE_THE_GENERATED_PUBLIC_KEY_HERE'
```

Only the public key belongs in the frontend. Save and deploy the change.

## 4. Member device test
1. Open the production RIBACOM website in a supported browser over HTTPS.
2. Sign in to a member account.
3. Open Notifications and choose **Enable phone alerts**.
4. Allow notifications when the browser asks.
5. Choose **Send test alert**.
6. Confirm that the device receives “RIBACOM Test Alert”.

On iPhone/iPad, web push generally requires iOS/iPadOS 16.4 or later and the website added to the Home Screen. Android browser support varies by browser and device settings.

## Current implementation scope
- `sw.js` displays received push messages.
- `push-notifications.js` handles opt-in, subscription storage, disable, in-app refresh, and a self-test call.
- Supabase Edge Function `send-member-push-test` sends a test only to the authenticated user's registered device subscriptions.
- Content-publishing triggers create in-app database notifications for the configured sections.

## Not yet complete
The VAPID secrets have not been configured through the available project tools, and actual device delivery has not been verified. The test endpoint sends only a self-test; automatic phone push for each new publication still needs a secure server-side notification dispatcher wired to newly created database notifications.
