# MistakeOS launch-readiness audit

Status: **CODE READY FOR INTERNAL PREVIEW; NOT READY FOR PUBLIC RELEASE** until the P0 owner/dashboard actions below are completed and the target environment is verified. This audit is not a legal certification or a substitute for device/store review.

## Scope and evidence

- App: Expo/React Native 0.86, Android/iOS/Web export.
- Backend: Supabase Auth, Postgres with RLS, Edge Functions; RevenueCat entitlement webhook; Groq question-photo analysis.
- Evidence reviewed: app configuration, source, migrations, environment template, tests, linked Supabase advisors, and the web-export configuration.
- No real key was found in tracked source during this audit. `.env`, `.env.*`, and `*.local` remain ignored; `.env.example` contains names/placeholders only.

## Before implementation

| Area | Result | Priority | Notes |
| --- | --- | --- | --- |
| Auth, session persistence, sign-out | Implemented | — | Supabase public client uses persisted AsyncStorage sessions; no service role in the client. |
| Account deletion | Absent | P0 | No authenticated server-side deletion path or local-data removal. |
| Legal/privacy/support | Absent | P0 | No policy/terms/support route or data map. Drafts are added in this change and require owner/legal review. |
| Local startup migration | Unsafe | P0 | `ensureFreshLocalCache` erased learning records and question photos on first run. |
| Supabase function grants | Unsafe | P0 | Linked advisor found Study Circle SECURITY DEFINER functions callable by `anon`. |
| Password leaked-password protection | Dashboard setting disabled | P0 | Must be enabled in Supabase Auth settings on a qualifying plan. |
| RLS on user data | Implemented, needs regression tests | P1 | RLS is enabled; SQL functions require explicit role grants after the hardening migration. |
| Offline/local-first creates | Partial | P1 | Mistakes/exams persist locally first; failed cloud writes have no durable retry queue or UI sync state. |
| Export, delete individual data, undo | Absent/partial | P1 | Exam delete exists but lacks undo; no data export or individual mistake deletion. |
| Accessibility/mobile keyboard | Partial | P1 | Key inputs and primary controls are labelled; full TalkBack/VoiceOver, 360×740 keyboard and external-keyboard passes remain manual QA. |
| Notifications/reminders | Absent | P2 | No notification permissions, scheduling or deep link landing model. |
| Web SEO/discovery | Partial | P1 | Favicon exists; route titles, descriptions, OG, `robots.txt`, sitemap and a product 404 page are absent. |
| Observability | Partial | P1 | Typed analytics is a no-op by default and avoids raw private text, but there is no production error-monitoring policy/provider. |
| Store/package/subscription readiness | Partial | P1 | RevenueCat client is present; purchase product/store setup, pricing disclosure, cancellation, restoration and reviewer access still need human verification. |

## Implemented P0 corrections

1. Local startup schema marking now preserves learning records and photo references. Only a confirmed account deletion invokes local-data clearing.
2. `delete-account` Edge Function accepts POST only, recovers the user solely from a verified JWT, and uses the service role only inside the function to hard-delete that user. The client neither sends a user id nor receives a service-role secret.
3. The signed-in account screen now offers an explicit destructive confirmation. A successful deletion signs out locally and clears MistakeOS learning data/photo cache on that device. PostgreSQL foreign keys remove rows owned by the deleted auth user. The confirmation warns that App Store/Google Play subscriptions must be cancelled in the relevant store.
4. SQL explicitly revokes Study Circle and ranking RPC execution from `anon` and grants only intended authenticated RPCs. Internal `is_circle_member` is not directly executable by users.
5. Draft privacy, terms, data map, minors review and this readiness document are now versioned in `docs/`.

## Required deployment and owner actions

Do not call the app launch-ready until every item is checked:

1. Review and fill the placeholders in `docs/PRIVACY_POLICY_DRAFT.md` and `docs/TERMS_OF_SERVICE_DRAFT.md`, publish stable public URLs, and link them from Settings and store listings. Obtain counsel review for the jurisdictions and ages actually targeted.
2. For any target Supabase project that has not already received the migrations, run the migration preview, then apply them:

   ```bash
   npx supabase db push --dry-run --linked --skip-vault
   npx supabase db push
   ```

3. If the target project does not yet have it, deploy the account-deletion function:

   ```bash
   npx supabase functions deploy delete-account
   ```

4. In Supabase Dashboard → Authentication → Password Security: configure a strong password policy and enable leaked-password protection if the project plan supports it. This cannot be enabled safely from this repository.
5. Run `npx supabase db advisors --linked --type security --level info` after deploy. The old anonymous-function warnings must be gone. Keep `ai_feature_limits` server-only; its no-policy advisory is intentional only while it has no client grants.
6. Configure production email/redirect URLs and a custom SMTP provider before inviting real users. In Supabase Authentication → URL Configuration add `mistakeos://auth/callback` and `mistakeos://reset-password`; then confirm sender, deliverability, rate limits, both email-link flows and the support inbox.
7. In RevenueCat and each store, verify product IDs, offerings, price/currency/trial disclosure, restore purchases, cancellation/manage-subscription route, reviewer/test account and the Supabase UUID App User ID mapping. Do not promise billing behavior not confirmed in those systems.

## P1 implementation queue

- User-visible saved/offline/failed feedback and safe retry status. Local mistake/exam records are now retried when the app reloads or becomes active, but failed remote deletes still need a tombstone queue.
- Individual mistake deletion and bounded undo where appropriate. Exam deletion now requires confirmation; data export is available as device share-sheet JSON and intentionally excludes original device photos.
- Privacy-safe production error monitoring with retention/access policy; do not send email, question text, image bytes, answers, tokens or raw failure payloads.
- Full RLS regression tests for anon/auth/other-user/owner/member, SQL grant tests, account-deletion cascade test and migration upgrade test on a disposable database.
- Local-timezone rules for daily limits/streaks/ranking; document date formatting/timezone behavior and test DST boundaries.
- Accessibility pass: TalkBack/VoiceOver labels, dynamic type, contrast, focus order, screen reader status messages, keyboard navigation and reduced motion.
- Web metadata per public page, canonical URL, OpenGraph preview, robots/sitemap and useful 404 behavior once a public marketing domain exists.
- Support workflow: published contact address, support SLAs/triage, account/data request workflow and a clear paid cancellation path.

## P2 / follow-up

- Optional local notifications only after an explicit user opt-in and an educational value test.
- Reviewer/demo data reset tooling that cannot touch production accounts.
- Crash-reporting provider evaluation with documented opt-in/retention and privacy review.

## Manual QA before release

- Fresh install, sign-up, email confirmation, sign-in, sign-out, force-close/reopen and failed-auth states.
- Account deletion on a non-production test account: verify blocked JWT, removed profile/data according to FKs, cleared device cache, and clear subscription guidance.
- Airplane mode: add mistake/exam, restart, restore connection, verify no silent loss and accurate sync feedback.
- Android 360×740 and iPhone small/large sizes: keyboard for every auth field; display-size/font-scale; light/dark and EN/pt-BR.
- Real photo permission denial/retry, photo daily limit at local midnight, AI timeout/rate-limit/error and manual-save fallback.
- Group invite, join, leave/removal, permissions between two accounts, ranking boundaries and no private mistake/photo exposure.
- RevenueCat purchase/restore/manage/cancel in sandbox and all legal/support links on mobile and web.

## Validation recorded in this repository

Run after changes: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build:web`. Android emulator/device validation cannot be claimed until executed on a configured SDK/device.
