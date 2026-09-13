# Checklist antes de rodar

- [ ] Estou em `C:\Users\dello\MistakeOS` no terminal.
- [ ] Rodei `npm install` se baixei mudanças novas.
- [ ] O `.env` existe localmente e não está no Git.
- [ ] Para celular/emulador, estou usando `npx expo start --dev-client --clear`.
- [ ] Para análise local de foto, abri o segundo terminal com `npm run server:analysis`.

## Antes de entregar uma alteração

```powershell
npm run typecheck
npm run lint
npm test
```

Voltar: [[00 - MistakeOS]]
