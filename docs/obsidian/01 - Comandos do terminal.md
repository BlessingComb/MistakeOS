# Comandos do terminal

Primeiro, entre na pasta do projeto:

```powershell
cd C:\Users\dello\MistakeOS
```

| Ação | Comando | Quando usar |
| --- | --- | --- |
| Instalar pacotes | `npm install` | Primeira vez ou depois de alterar dependências |
| Rodar no celular/emulador | `npx expo start --dev-client --clear` | Uso normal diário |
| Rodar no navegador | `npm run web` | Teste rápido de interface |
| Servidor local da análise de fotos | `npm run server:analysis` | Apenas para testar o proxy local de análise |
| TypeScript | `npm run typecheck` | Antes de finalizar alteração |
| Lint | `npm run lint` | Antes de finalizar alteração |
| Testes | `npm test` | Antes de finalizar alteração |
| Build web | `npm run build:web` | Antes de publicar/verificar versão web |

## Dois terminais para análise local de fotos

**Terminal 1**

```powershell
npx expo start --dev-client --clear
```

**Terminal 2**

```powershell
npm run server:analysis
```

## Android

`npx expo run:android` recompila a development build. Use apenas quando a build ainda não existe ou depois de uma alteração nativa, como em `app.json` ou dependências nativas. Ele precisa de Android Studio, SDK e `adb` configurados.

Voltar: [[00 - MistakeOS]]
