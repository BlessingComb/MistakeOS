# MistakeOS

Premium mobile-first prototype for turning recurring study mistakes into visible, actionable mastery.

## Core experience

- **Risk Score** — a pressure-field visualization with distinct HIGH RISK, RECOVERING, and MASTERED states.
- **Mistake DNA** — recurring error patterns rendered as a behavioral genome rather than a percentage table.
- **Never Again Review** — a short, distraction-free intervention where correct decisions visibly reduce risk.
- **Mastery moment** — motion and haptic feedback make a mastered topic feel earned.
- **Exam Prep Map** — a prioritized plan of the real mistake patterns to address before an upcoming exam.

## Run

```bash
npm install
npm start
```

Use `npm run web` for a browser preview. Native purchases require the project development build; Expo Go does not include RevenueCat's native modules.

## Secure photo error analysis

Production photo analysis uses this path:

`authenticated app → Supabase Edge Function → atomic allowance check → Groq → validated result → usage event`

The production client never receives or calls Groq with `GROQ_API_KEY`. The legacy Node proxy in `server/` is restricted to local development because production builds ignore `EXPO_PUBLIC_MISTAKE_ANALYSIS_URL`.

### Supabase deployment

Link the CLI, apply migrations, configure the server-only secret, and deploy:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set GROQ_API_KEY=YOUR_GROQ_KEY
npx supabase secrets set GROQ_MODEL=qwen/qwen3.6-27b
npx supabase functions deploy analyze-mistake
```

If `20260825010532_social_system.sql` was previously pasted into SQL Editor instead of applied by the CLI, mark only that already-executed version before `db push`:

```bash
npx supabase migration repair --linked --status applied 20260825010532
npx supabase db push --dry-run
npx supabase db push
```

Optional cost rates can be set server-side with `GROQ_INPUT_USD_PER_MILLION` and `GROQ_OUTPUT_USD_PER_MILLION`. If they are absent, token counts are still recorded and estimated cost remains null rather than invented.

The client needs only the public project values:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The migration creates private user-owned mistakes, exams, recovery evidence, immutable AI events, server-only Free/Pro limit configuration, and a RevenueCat entitlement-sync boundary. Free is enforced at 5 analyses/month. Pro is 100/month only after a trusted RevenueCat backend writes the `pro` entitlement; the app cannot grant itself Pro.

RevenueCat server sync is intentionally not faked. Before Pro receives the server allowance, configure RevenueCat to use the Supabase user UUID as its App User ID and add a verified webhook/backend worker that updates `subscription_entitlements`. Until that trusted sync exists, the Edge Function securely applies the Free limit even when the native client recognizes Pro.

Original photos remain only in the device cache in Phase 1. The Edge Function receives the selected image inline, persists the normalized result, and does not upload the original to Supabase Storage.

### Local-only proxy

1. Create a free API key at `https://console.groq.com/keys`.
2. Put `GROQ_API_KEY` only in the ignored local `.env` file.
3. In one terminal, run `npm run server:analysis`.
4. In another terminal, run `npm run web -- --port 8081`.

The web development client can use `http://localhost:8787/analyze-question` only when Supabase is not configured. Production builds cannot use this fallback.

The Free Plan has quotas. Groq states that inference data is not retained by default, except temporarily for reliability or abuse investigations, and provides a Zero Data Retention control. MistakeOS still warns users to remove names, faces, student IDs, and other personal information before analysis. The model must return `insufficient` when the student's attempted solution or selected answer is not visible; the app never invents an error from the question alone.

## RevenueCat development

MistakeOS uses RevenueCat as the only source of truth for Pro access:

`CustomerInfo → entitlements.active["pro"] → free/pro capability foundation`

Only public SDK keys are accepted through the environment variables documented in `.env.example`. Development builds prefer the Test Store key; production builds ignore it and use the platform-specific Apple or Google Play key. Product identifiers and prices are not hardcoded: the app reads the current RevenueCat offering and supports its monthly and annual packages.

Before the first EAS build, choose the permanent iOS bundle identifier and Android application ID, add them to `app.json`, and use the same identifiers in RevenueCat and the stores. Then initialize/link the EAS project and build:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile development
npx eas-cli build --platform ios --profile development
npx eas-cli build --platform ios --profile development-simulator
```

After installing the build, start Metro with `npx expo start --dev-client`.

## Quality checks

```bash
npm run typecheck
npm run build:web
```

## Design system

All color, typography, spacing, radius, shadow, and motion tokens live in `src/theme.ts`. The visual language uses a recurring circular pressure field, technical mono labels, editorial typography, and a restrained semantic palette: coral for risk, amber for recovery, green for mastery, and acid-lime for system readiness.

## Internationalization

MistakeOS ships with English and Brazilian Portuguese. English is the fallback language, while Portuguese devices (`pt`, `pt-BR`, `pt-PT`, and compatible tags) start in Portuguese. A manual choice in **Settings → Language** takes effect immediately and is persisted with AsyncStorage under a versioned key.

Translations are local, typed, and API-free:

- `src/i18n/en.ts` — English source catalog;
- `src/i18n/ptBR.ts` — Brazilian Portuguese catalog with compile-time key parity;
- `src/i18n/core.ts` — detection, fallback, interpolation, persistence, and locale mapping;
- `src/i18n/I18nProvider.tsx` — React context and `useTranslation()`.

The product names **Mistake DNA**, **Risk Score**, **Never Again**, and **MistakeOS** are preserved in both languages. **Exam Prep Map** is localized as **Mapa de Preparação** in Brazilian Portuguese. Question data stores translation keys while mathematical logic and answers remain language-independent.
