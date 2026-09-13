# Serviços e ambiente

## Expo

- App mobile: `npx expo start --dev-client --clear`
- Web: `npm run web`

## Análise local de fotos

- Comando: `npm run server:analysis`
- Porta padrão: `8787`
- Requer `GROQ_API_KEY` apenas no arquivo local `.env`.

## Supabase

Use depois de estar autenticado e com o projeto vinculado:

```powershell
npx supabase db push --linked
npx supabase functions deploy analyze-mistake
```

Use primeiro o modo seguro para conferir migrations pendentes:

```powershell
npx supabase db push --dry-run --linked
```

## RevenueCat

RevenueCat é a fonte de verdade para o plano Pro. Use apenas as chaves públicas `EXPO_PUBLIC_REVENUECAT_*` no `.env`; chaves secretas nunca entram no app.

Voltar: [[00 - MistakeOS]]
