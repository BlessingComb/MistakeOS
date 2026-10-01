# MistakeOS

> Learn from what went wrong.

MistakeOS is a learning platform built around a simple idea:
students should not keep repeating the same mistakes.

Instead of treating a wrong answer as something disposable, MistakeOS turns
it into structured learning data. Students can register mistakes, understand
why they happened, identify recurring patterns, and receive targeted practice
based on the skills that need the most attention.

## Why MistakeOS?

Most learning platforms focus on delivering more content.

MistakeOS focuses on understanding what went wrong.

> MistakeOS doesn't just correct your mistakes. It remembers them.

## Core Features

### Mistake Analysis

Students can register a mistake, optionally attach a question photo, and receive a structured analysis when the authenticated analysis service is configured. The student's attempt is needed to analyze what went wrong; a question photo alone is not treated as evidence of an error.

### Mistake History and DNA

Mistakes become part of a private learning history. Recurring causes and topics can be identified over time.

### Targeted Recovery

Students can revisit mistakes and practice the relevant skills. Progress is based on demonstrated learning, not fabricated activity.

### Personal Exam Dates

Students can record upcoming exams and revisit relevant mistakes.

### Classrooms

Students join with an invitation code. Authorized teachers can create classes and see aggregate learning insights. Teacher access is permission-based; students cannot grant themselves that role. Classroom insights do not reveal private mistake photos, answers, or AI analyses.

### MistakeOS Pro

RevenueCat manages native purchase offerings and the `mistakeos_pro` entitlement. The app reads RevenueCat customer information to present the local Pro state. Server-side access is verified separately; a client display alone does not grant a larger AI allowance.

### Exam Preparation

The repository contains entrance-exam catalog and practice infrastructure, but the **vestibular preparation interface is hidden in the current Shipaton web demo** while that experience is being completed. Do not treat PSC, SIS, ENEM, or other catalogs as fully available in this build merely because their code or data exists here.

## RevenueCat

The native iOS and Android app integrates the RevenueCat client SDK for the `mistakeos_pro` entitlement, current offerings, purchases, restoration, and Customer Center. The app uses RevenueCat `CustomerInfo` to determine its local Free/Pro presentation; package identifiers and prices come from the active offering rather than hardcoded values. Development builds may use a public Test Store SDK key, while production builds use the appropriate public Apple or Google Play SDK key. The web client does **not** offer purchases.

Server-side AI allowances are separate from the client display. A verified RevenueCat webhook can synchronize subscription events to Supabase; a client-side Pro state alone cannot grant the server-side Pro allowance. Keep the webhook authorization value and Supabase service-role credential exclusively in server-side secrets. Never put a secret key in an `EXPO_PUBLIC_` variable.

## Tech Stack

React Native, Expo, TypeScript, Supabase Auth and PostgreSQL, Supabase Edge Functions, RevenueCat for native subscriptions, and Groq behind the authenticated server-side photo-analysis boundary.

## Getting Started

### Prerequisites

- Node.js and npm.
- Supabase CLI and Docker Desktop if you want to run the local database and Edge Functions.
- A native development environment and development build for iOS or Android; the web app can be started separately.

### Installation

```bash
git clone https://github.com/BlessingComb/MistakeOS.git
cd MistakeOS
npm install
```

### Environment Variables

Copy `.env.example` to an ignored `.env` file and fill in only the values needed for your environment. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configure the Supabase client; `EXPO_PUBLIC_SUPABASE_ANON_KEY` is a legacy fallback. Public RevenueCat SDK keys are optional for the respective native platforms. Variables prefixed `EXPO_PUBLIC_` are bundled into the client. Configure server-only variables in a private server or Edge Function environment, never in a public build. Do not commit `.env` or put Groq, Supabase service-role, RevenueCat webhook, or other server secrets in client variables.

### Running the App

```bash
npm run start
npm run web
```

Use one of these commands at a time. `npm run start` starts Expo for a development build; `npm run web` starts the browser version. The package also provides `npm run android` and `npm run ios` for native development where the required platform tooling is installed.

For the local Supabase stack, with Docker running:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` recreates the **local** database and erases its local data. It is not necessary for ordinary frontend development. Do not run `db push` against a remote project as part of setup. The optional `npm run server:analysis` script starts a local development-only photo-analysis proxy and requires a private `GROQ_API_KEY` in the ignored local `.env`; production photo analysis uses the Supabase Edge Function instead.

### Tests

```bash
npm run lint
npm run typecheck
npm test
npm run build:web
```

`npm run build:web` writes the static web export to `dist/`.

## Security and Privacy

Supabase Auth owns sessions. Private learning records and teacher access are protected by database policies and server-side authorization. Question answer keys are not sent to the client before an attempt. The photo-analysis client never receives the Groq API key; selected images are sent to the authenticated analysis endpoint, so remove personal information from photos before submission.

`.env.example` contains only empty values for client and server configuration; server-only values must never be exposed in a client build. Real local environment files are ignored by Git. Before publishing a fork, review both the current files and Git history for credentials and personal data. See [the release checklist](docs/LAUNCH_READINESS.md) and [classroom role setup](docs/classrooms-setup.md) for operational requirements.

## Project Status

MistakeOS is currently in active development and was built for the RevenueCat Shipaton 2026.

Some features and exam catalogs are still being expanded. The vestibular preparation interface is hidden in the current Shipaton web demo while that experience is being completed.

## Roadmap

Future plans, not currently available features:

- More entrance exams.
- Additional integrations.
- Expanded teacher analytics.
- Personalized AI tutoring based on mistake history and learning progress.

## License

MistakeOS is open source under the MIT License.

See [LICENSE](LICENSE). Third-party packages retain their own licenses.
