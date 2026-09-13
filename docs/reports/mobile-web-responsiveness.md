# MistakeOS — responsividade Web mobile

Data: 2026-09-13. Alterações locais; nenhum deploy, alteração de Supabase ou regra acadêmica.

## Diagnóstico

- O HTML exportado pelo Expo já contém `width=device-width, initial-scale=1`. Não havia viewport desktop imposta no HTML.
- A tab bar possuía cinco itens com `minWidth: 52`, padding horizontal de 16 por item e texto adicional no ativo. Em 320 px, a área útil da barra é aproximadamente 270 px; a soma dos mínimos e do texto do ativo ultrapassava esse espaço.
- `AmbientField` continha um círculo com largura 460 e `right: -230`, fora dos limites da página. A camada decorativa não recortava os próprios filhos. Agora ela recorta somente a decoração.
- A saudação da Home não tinha restrição flexível para o texto ao lado do avatar. Cards de revisão e empty state impunham texto/CTA na mesma linha em todas as larguras.
- O botão primário compartilhado não reservava uma coluna flexível para seu texto, permitindo que um label longo disputasse espaço com a seta.
- Os atalhos usavam três colunas de 30% também no celular. Essa largura deixava os textos desnecessariamente apertados; agora a quantidade de colunas responde ao resize.
- `html`, `body` e `#root` não possuíam um fundo explícito correspondente ao tema. O espaço além da superfície do app podia expor o fundo branco do navegador. O fundo do documento agora acompanha o tema.

Os `maxWidth` existentes de telas centrais não foram removidos: eles limitam a largura em desktop e não impõem uma largura mínima no mobile. O `Dimensions.get()` de AccountScreen é uma leitura feita durante a medição do teclado, não um cálculo estático de largura desktop.

## Correção

Home: padding de 16 px abaixo de 600 px; texto flexível na saudação e nos cards; card da prova com padding compacto; revisão e empty state com CTA empilhado; labels de progresso podem quebrar linha. Desktop mantém o container de 760 px e a composição horizontal.

Acesso rápido: duas colunas abaixo de 600 px, três em telas maiores. O cálculo considera a largura do container, seu padding e os gaps. Todos os seis atalhos permanecem.

Tab bar: cinco áreas flexíveis, sem o mínimo rígido anterior. No mobile, o nome do item ativo aparece abaixo do ícone; os demais mantêm seus nomes de acessibilidade. Desktop mantém o nome ao lado do ícone. O espaçamento inferior web considera `env(safe-area-inset-bottom)`.

Botão compartilhado: texto com `flex: 1` e `minWidth: 0`, preservando a seta. Beneficia as telas de cadastro de erros, preparação, treino e turmas sem mudar suas ações.

Documento web: largura de 100%, margem zero e fundo sincronizado com o tema. Nenhum novo `overflow-x: hidden` foi aplicado ao documento. O reset de ScrollView já fornecido pelo Expo permanece.

## Validação

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 160 testes passaram.
- `npm run build:web`: passou; HTML, CSS, JavaScript e assets exportados em `dist`.
- `git diff --check`: passou.
- Chromium/Edge headless, build exportado: 174 verificações de layout em português e inglês, sem overflow horizontal detectado.
- Larguras principais: 320×700, 360×800, 375×812, 390×844, 412×915, 430×932, 768×1024 e 1440×900.
- Login/cadastro também verificados nessas oito larguras, com altura 844; Home vazia em sete larguras com altura 844.
- Telas: Home com evidências, Home vazia, Meus Erros, Preparação, Treino, Turmas, Professor, Perfil, Registrar erro, Login e Cadastro.
- Medições incluem largura do documento, bounds dos elementos e dos cinco tabs. Capturas foram inspecionadas visualmente para quebra dos textos, cards e composição mobile/desktop.

Os dados de catálogo, conta, turma e questões são fixtures exclusivas do navegador de teste. Todas as requisições externas são interceptadas: não existe acesso ou escrita no Supabase durante esse teste. As fixtures não são importadas pelo aplicativo.

Limites: a validação é de layout em navegador Chromium local. Não equivale a teste em um aparelho físico, Safari/iOS ou autenticação/RLS real. Não houve deploy; o domínio público permanece na versão já publicada.

## Reproduzir

Na raiz `C:\Users\dello\MistakeOS`:

```powershell
npm run build:web
npm install --prefix tmp/responsive-tools --no-package-lock --no-audit --no-fund playwright
node scripts/responsive-web-check.cjs
```

O script usa o Microsoft Edge instalado no caminho padrão. Para outro Chromium, defina `PLAYWRIGHT_BROWSER_PATH` com o caminho do executável. O servidor é temporário e atende apenas `127.0.0.1:4178`.

Resultados e screenshots: `tmp/responsive-results/`. Essa pasta e as dependências de teste ficam ignoradas no Git.

## Arquivos desta correção

- `App.tsx`
- `src/screens/HomeScreen.tsx`
- `src/components/PrimaryButton.tsx`
- `src/components/TabBar.tsx`
- `src/theme/ThemeProvider.tsx`
- `src/webLayout.ts`
- `src/webLayout.web.ts`
- `src/webLayout.css`
- `src/webStyles.d.ts`
- `scripts/responsive-web-check.cjs`
- `docs/reports/mobile-web-responsiveness.md`

As demais alterações preexistentes da árvore de trabalho não fazem parte desta correção.

READY FOR WEB REDEPLOY: SIM, quanto à correção de responsividade validada localmente. Publicação não executada.
