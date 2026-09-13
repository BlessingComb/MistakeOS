# MistakeOS

Premium mobile-first prototype for turning recurring study mistakes into visible, actionable mastery.

## Core experience

- **Risk Score** — a pressure-field visualization with distinct HIGH RISK, RECOVERING, and MASTERED states.
- **Mistake DNA** — recurring error patterns rendered as a behavioral genome rather than a percentage table.
- **Never Again Review** — a short, distraction-free intervention where correct decisions visibly reduce risk.
- **Mastery moment** — motion and haptic feedback make a mastered topic feel earned.
- **Exam Prep Map** — a prioritized plan of the real mistake patterns to address before an upcoming exam.

## Comece aqui — comandos do terminal

Abra o terminal na pasta do projeto antes de rodar qualquer comando:

```powershell
cd C:\Users\dello\MistakeOS
```

| Quero… | Comando |
| --- | --- |
| Instalar dependências (apenas na primeira vez ou após atualizar o projeto) | `npm install` |
| Abrir o app na development build já instalada no celular/emulador | `npx expo start --dev-client --clear` |
| Abrir a versão web no navegador | `npm run web` |
| Iniciar o servidor local de análise de fotos | `npm run server:analysis` |
| Verificar erros de TypeScript | `npm run typecheck` |
| Verificar estilo/código | `npm run lint` |
| Rodar os testes | `npm test` |
| Gerar a versão web | `npm run build:web` |

### Fluxo normal no celular

1. Abra **um terminal** e rode:

   ```powershell
   npx expo start --dev-client --clear
   ```

2. Abra a development build do MistakeOS no celular ou inicie o emulador Android e pressione `a` nesse terminal.

3. Só abra um **segundo terminal** quando for testar a análise local de fotos:

   ```powershell
   npm run server:analysis
   ```

`npx expo run:android` só é necessário para criar/recriar a development build nativa. Ele exige Android Studio, SDK Android e `adb` configurados. Para o uso diário após a build já estar instalada, use `npx expo start --dev-client --clear`.

> Nunca coloque chaves secretas no README. Valores locais ficam somente no arquivo `.env`, que não deve ser versionado.

## Obsidian

A pasta [`docs/obsidian`](docs/obsidian) é um mini-vault Markdown. No Obsidian, use **Open folder as vault** e selecione essa pasta para ter um painel de comandos e notas do projeto.

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

### Password recovery redirect

MistakeOS opens email links back in the installed app. In **Supabase Dashboard → Authentication → URL Configuration**, add both exact redirect URLs before testing email confirmation or password recovery:

```text
mistakeos://auth/callback
mistakeos://reset-password
```

Keep the production app scheme stable after release.

The migrations create private user-owned mistakes, exams, server-verified recovery evidence, immutable AI events, server-only Free/Pro limit configuration, and a RevenueCat entitlement-sync boundary. Free is enforced at 5 analyses/day. Pro is 50/day only after a trusted RevenueCat backend writes the `pro` entitlement; the app cannot grant itself Pro.

RevenueCat server sync is intentionally not faked. Before Pro receives the server allowance, configure RevenueCat to use the Supabase user UUID as its App User ID and add a verified webhook/backend worker that updates `subscription_entitlements`. Until that trusted sync exists, the Edge Function securely applies the Free limit even when the native client recognizes Pro.

### Production security checklist

Before release, configure these controls in **Supabase Dashboard → Authentication**:

1. Keep email confirmation enabled and allow only the two documented `mistakeos://` redirect URLs.
2. Configure Auth rate limits and CAPTCHA/anti-bot protection for sign-up, sign-in and password reset. The app also applies a small user-interface cooldown, but it is not a replacement for server-side rate limits.
3. Disable Anonymous Auth unless a future feature explicitly requires it.
4. Configure production SMTP before inviting real users.

On Android and iOS, Supabase session tokens are stored through `expo-secure-store` (Android Keystore/iOS Keychain). Learning records and question photos remain device-local, so users should protect their device and remove personal information from photos before analysis.

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

For an internal test package or a store-ready build, use the committed EAS profiles:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

## Quality checks

```bash
npm run typecheck
npm run build:web
```

## Launch safety and account deletion

Before a public release, read [`docs/LAUNCH_READINESS.md`](docs/LAUNCH_READINESS.md). It records implemented safeguards, manual device QA, user-facing gaps, and dashboard tasks that cannot be completed by code alone.

The account-deletion feature needs the database migrations and Edge Function deployed before it is shown as production-ready:

```bash
npx supabase db push --dry-run --linked --skip-vault
npx supabase db push
npx supabase functions deploy delete-account
npx supabase db advisors --linked --type security --level info
```

The app never stores a Supabase service-role key. The server-side function determines the account from the caller's verified session. Review the published privacy/terms drafts and configure a monitored support email before release.

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
