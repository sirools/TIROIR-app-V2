# Tiroir

Tiroir is a photo-first inventory app: take a photo of an object, get an
AI-written card, then organise, search and share your collections.

- `mobile/` — the iOS app (Expo SDK 56)
- `web/` — the website (Next.js, Pages Router)
- `supabase/` — database migrations and Edge Functions
- `design/` — design tokens and translations (single source of truth)

Licence: [MIT](LICENSE).

## Hackathon — #BuildHybridAI 2026

Built during the hackathon period: **Express card** (« Fiche express »), a
hybrid AI brick that goes through **Firebase AI Logic** only.

1. You take a photo of an object.
2. **On device**, with no network: the built-in model proposes a name, a
   category and a short description. The card is saved as a draft on the
   device.
3. **In the cloud**, once the network is there: Gemini adds a detailed
   description and a second-hand value estimate, signed Torix.
4. If the device has no built-in model, everything goes to the cloud, with
   no visible error.

Every piece of information carries a badge, “On device” or “Cloud”.

| Where | What |
| --- | --- |
| `web/lib/hybridAI/types.ts` | the `HybridAI` contract shared by every platform |
| `web/lib/hybridAI/web.ts` | web implementation: Firebase AI Logic, Chrome built-in model, cloud fallback |
| `web/lib/hybridAI/firebase.ts` | Firebase and App Check setup, from environment variables |
| `web/lib/hybridAI/card.ts` | prompts, JSON schemas, answer parsing |
| `web/lib/hybridAI/drafts.ts` | drafts kept on the device |
| `web/pages/fiche-express.tsx` | the page |
| `web/__tests__/hybridAI.test.ts` | tests |

On iPhone, Apple's on-device model is text-only: Apple's Vision framework
first reads the photo on the device (image labels and visible text), then
the on-device model writes the card from that. The cloud step sends the
photo itself to Gemini.

| Where (iOS) | What |
| --- | --- |
| `mobile/modules/tiroir-hybrid-ai/ios/TiroirHybridAIModule.swift` | native module: Vision, Apple Foundation Models, Gemini through Firebase AI Logic, App Check |
| `mobile/src/services/hybridAI/ios.ts` | iOS implementation of `HybridAI`, device → cloud hand-over |
| `mobile/app/(app)/capture/express.tsx` | the screen |
| `mobile/plugins/withFirebaseSpm.js`, `mobile/app.config.js` | Firebase (Swift Package Manager) added to the hackathon build only |

Status: the **web** side runs and is tested in a browser. The **iOS** side
is written but has **not been compiled or run on a device yet**.

### Build the iOS app

Requirements: a Mac with Xcode 26.2 or later (or EAS Build), an iPhone with
Apple Intelligence turned on for the on-device step, the Firebase iOS app
registered for the bundle identifier `com.sirools.tiroir`.

```bash
cd mobile
npm install
cp .env.example .env
```

In `mobile/.env`: set `EXPO_PUBLIC_HACKATHON_BUILD=true`, fill the
`EXPO_PUBLIC_FIREBASE_*` values from `GoogleService-Info.plist`, and the
Supabase values (the app needs an account to open).

```bash
eas build --profile hackathon --platform ios
```

In the app: Capture › Express card. The screen shows the App Check debug
token of the installation; register it in the Firebase console.

### Run the web demo

Requirements: Node 22, a Firebase project with **AI Logic** enabled
(Gemini Developer API) and a registered web app.

```bash
cd web
npm install
cp .env.example .env.local
```

In `web/.env.local`:

- set `NEXT_PUBLIC_HACKATHON_BUILD=true`;
- fill the `NEXT_PUBLIC_FIREBASE_*` values from your Firebase web app;
- set `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=true`.

```bash
npm run dev
```

Open `http://localhost:3000/fiche-express` (English: `/en/fiche-express`).
The browser console prints an App Check debug token: register it in the
Firebase console (Security › App Check › Apps › Manage debug tokens), then
paste it as the value of `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` and
restart.

The Supabase and Stripe variables are not needed for this page.

**On-device model.** Use Chrome on desktop. The page shows the state of
the built-in model and offers to download it. Chrome needs about 22 GB of
free disk space, and either more than 4 GB of video memory or 16 GB of
RAM. On older Chrome versions, enable
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`.

**See the hand-over.** Open DevTools › Network, tick “Offline”, pick a
photo: the quick card appears with the “On device” badge and stays a
draft. Untick “Offline”: the cloud enrichment arrives with the “Cloud”
badge.

### Tests

```bash
cd web
npx vitest run __tests__/hybridAI.test.ts
```
