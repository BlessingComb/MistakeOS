# MistakeOS privacy data map

Status: internal operational draft, 2026-09-01. This is an engineering data map, not a privacy notice or legal advice.

## Data inventory

| Data | Source | Stored/processed by | Purpose | Retention/deletion |
| --- | --- | --- | --- | --- |
| Email, authenticated user ID, password hash/session | Supabase Auth | Supabase Auth | Sign-up, sign-in, account security | Auth user is hard-deleted by the authenticated account-deletion Edge Function. Passwords are never handled by MistakeOS app code. |
| Display name | Account sign-up | `public.profiles` | Presentation in account/groups/ranking | Deleted through account FK cascade. |
| Mistakes, subjects, topics, notes, repair rules, recovery evidence, exam dates/notes | Learner input | Device AsyncStorage; authenticated cloud tables when configured | Personal learning features | Local-first. Cloud rows follow auth-user foreign-key deletion; device cache clears after confirmed deletion on that device. |
| Question photo | Learner chooses camera/library | Device photo storage/IndexedDB; transiently sent to Groq through authenticated Edge Function when analysis is requested | Display and optional AI analysis | Not uploaded to Supabase Storage in the current phase. Device photo cache clears after confirmed deletion on that device. Users should remove names, faces, IDs and sensitive content before analysis. |
| AI normalized analysis and usage event | Groq response / server | Supabase private user tables | Deliver analysis, enforce allowance/audit usage | Removed through account deletion. Raw photo bytes are not persisted by this path. |
| Study Group profile name, group name, invite code, explicitly shared post/comment/reaction | Learner input | Supabase social tables | Private, invite-only group learning | Nothing is shared automatically from a private mistake. Auth deletion removes the user-owned rows through foreign keys; deleting an owner also deletes their group through current schema cascade. |
| RevenueCat App User ID / entitlement state | Auth UUID / RevenueCat webhook | RevenueCat and `subscription_entitlements` | Verify Pro access server-side | Supabase entitlement rows delete with the user. Store subscription cancellation is managed in the store/RevenueCat flow. |
| Typed product events | Local code | No-op unless a privacy-reviewed provider is configured | Product telemetry | Current event schema must never include raw email, question text, answer text, photos, tokens or secrets. |

## Data-flow boundaries

- The app uses only `EXPO_PUBLIC_*` Supabase values. Service-role, Groq, RevenueCat webhook and other secret credentials are server-side only.
- RLS and authenticated Edge Functions are the authorization boundary. Client-supplied `isPro`, user IDs for deletion, entitlement states or AI allowance values are not trusted.
- Groq is called only by `analyze-mistake`; it receives the selected photo and narrow context required for the chosen analysis. Do not route names, email, account identifiers, or unrelated history to the provider.
- Group ranking receives derived recovery evidence through RPC. It never receives question/photo/private mistake text.

## Access and retention gaps to resolve before public launch

- Publish precise vendor/subprocessor, region, retention and legal-basis terms only after the owner verifies actual Supabase, Groq, RevenueCat, app-store and analytics configurations.
- Define support/data-request handling, response times, backup deletion behavior and a reversible/irreversible deletion policy with counsel.
- If a crash/analytics SDK is added, approve its event allowlist, consent model, retention and access controls before shipping it.
