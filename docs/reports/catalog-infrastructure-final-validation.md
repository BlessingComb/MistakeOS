# Validação final local da infraestrutura de catálogos

Data: 2026-09-10<br>
Escopo: PSC 1, PSC 2, PSC 3, ENEM, Exam Prep e observabilidade de IA.<br>
Estado: revisão local; nenhum push, deploy, publicação, alteração remota ou commit.

## A. Inconsistências acadêmicas

- A soma declarada como 976 estava incorreta. As contagens aprovadas somam **1.141 associações**: 313 + 165 + 285 + 378.
- As associações correspondem a **1.137 códigos canônicos únicos**. Quatro associações reutilizam uma skill já existente em outro catálogo.
- O esquema de códigos não é uniforme: PSC 2 usa muitos códigos canônicos em inglês, enquanto PSC 1, PSC 3 e ENEM usam majoritariamente slugs em português. Isso não quebra o banco, mas reduz a detecção e reutilização automática de conceitos equivalentes.
- Foram encontrados 131 itens `REVIEW RECOMMENDED`, 14 `POSSIBLE DUPLICATE`, 4 `SOURCE AMBIGUITY` e nenhum `ERROR` nos relatórios individuais.
- Há vários itens compostos muito amplos. Eles preservam o nível de detalhe da fonte, mas podem diluir o Risk Score se tratados como uma única habilidade operacional. Qualquer divisão exige validação acadêmica e rastreabilidade; não foi feita automaticamente.

## B. Possíveis equivalências entre catálogos

| Catálogo A | Skill A | Catálogo B | Skill B | Confiança | Recomendação |
|---|---|---|---|---|---|
| PSC 1 | `chemistry.calculo-estequiometrico` — Cálculo estequiométrico | ENEM | `chemistry.calculos-estequiometricos` — Cálculos estequiométricos | alta | MERGE RECOMMENDED |
| PSC 1 | `literature.portuguese-indigenous-african-latin-american` | PSC 3 | `language.literatura-portuguesa-indigena-africana-e-a-latino-americana` | média-alta | PROFESSOR REVIEW |
| PSC 2 | `literature.portuguese-indigenous-african-latin-american` | PSC 3 | `language.literatura-portuguesa-indigena-africana-e-a-latino-americana` | média-alta | PROFESSOR REVIEW |
| PSC 3 | `biology.infeccoes-sexualmente-transmissiveis-ists` | ENEM | `biology.infeccoes-sexualmente-transmissiveis` | média | PROFESSOR REVIEW |

Não foram feitos merges. Conceitos homônimos em Física, Química, Biologia, Geografia, Matemática e Linguagens continuam separados quando o objeto de conhecimento e a evidência do erro são disciplinares.

## C. Revisão humana

O arquivo `catalog-professor-final-review.txt` contém somente:

- equivalências candidatas que não devem ser decididas automaticamente;
- todos os `POSSIBLE DUPLICATE`;
- todos os `SOURCE AMBIGUITY`;
- os tópicos compostos classificados como `REVIEW RECOMMENDED`.

O relatório completo e reproduzível está em `catalog-global-academic-audit.md`.

## D. Auditoria de escala

### Saudável

- `exam_catalog_skills` tem chave primária `(catalog_version_id, skill_code)`, adequada ao carregamento de um catálogo.
- `curriculum_skills.code` é chave primária e atende os joins por código.
- `mistake_skill_links` tem chave primária `(mistake_id, skill_code)` e índice `(skill_code, mistake_id)`.
- `recovery_sessions` possui índices para `mistake_id` e recuperação verificada nas migrations anteriores.
- O carregamento atual tem quantidade constante de chamadas; não há N+1 por skill.
- O app calcula readiness somente ao carregar/trocar o alvo; `useMemo` evita recomputação em renders sem mudança do estado oficial.
- A tela não renderiza as 300+ skills simultaneamente: mostra até três resumos por matéria e até cinco itens de atenção.
- Um catálogo de 378 itens é aceitável em memória no React Native e web.

### Riscos reais ou altamente prováveis

1. **Filtro `.in(...)` excessivamente grande.** `ExamPrepRepository` envia todos os códigos do catálogo no query string de `mistake_skill_links`. Com 378 códigos longos, a URL pode exceder limites de proxy/PostgREST. Correção mínima recomendada: uma RPC de leitura com `SECURITY INVOKER`/RLS ou função segura que faça o join servidor-side pelo `catalog_version_id`, sem receber `user_id`.
2. **Cálculo O(skills × links).** `buildOfficialExamReadiness` filtra todos os links para cada skill. Ainda é aceitável nesta escala, mas deve ser substituído por um `Map<skillCode, mistakeIds>` se o histórico crescer substancialmente.
3. **Erros intermediários tratados como vazio.** Falhas nas consultas de target, mappings, links e recoveries não são diferenciadas de ausência real de dados. Isso pode mostrar progresso vazio durante falha transitória. Deve haver estado técnico seguro/retry sem inventar métricas.
4. **Ordem não garantida — corrigido.** A consulta agora usa `order('display_order')`, preservando a ordem acadêmica oficial.

Não há necessidade atual de índice isolado em `curriculum_skills.subject_code`, pois o app carrega por catálogo e agrupa localmente. Reavaliar apenas se surgir consulta SQL seletiva por matéria.

## E. Auditoria das migrations

Ordem revisada:

1. `20260906120000_ai_cost_observability.sql`
2. `20260909120000_exam_prep_catalog.sql`
3. `20260909121000_psc_2027_stage_2_draft.sql`
4. `20260910120000_exam_assessment_framework.sql`
5. `20260910121000_psc_2027_stage_1_draft.sql`
6. `20260910122000_psc_2027_stage_3_draft.sql`
7. `20260910123000_enem_2026_reference_matrix_draft.sql`

Resultado estático:

- timestamps e dependências coerentes;
- foreign keys e restrições de unicidade coerentes;
- `assessment_framework` é opcional, validado e não participa de readiness;
- nenhum índice equivalente foi duplicado na observabilidade;
- ledger de custos sem acesso de `anon`/`authenticated`;
- RPCs privilegiadas com grants mínimos, `SECURITY DEFINER` e `search_path = ''`;
- `set_exam_target` e `link_mistake_to_skill` derivam identidade de `auth.uid()` e não aceitam `user_id`;
- políticas públicas expõem somente catálogos com `status='published'`;
- todos os quatro catálogos continuam `draft` e com `published_at = null`;
- imports não escrevem em `mistakes`, `mistake_skill_links` ou `exams` pessoais;
- PSC 2 permanece com 165 associações;
- `SubjectId` legado é preservado por `legacy_subject_id`;
- não foi encontrada operação de perda de dados. A remoção da constraint antiga de observabilidade é acompanhada pela nova unicidade por request/attempt.

Limitação: esta conclusão é estática. A aplicação real do zero e os grants efetivos precisam do PostgreSQL local.

## F–J. PostgreSQL local, pgTAP, RLS, concorrência e contagens

**Não executados: ambiente local indisponível.**

- Docker Desktop: ausente do PATH.
- Podman: ausente do PATH.
- Supabase CLI via `npx`: disponível, versão 2.117.0.
- `supabase/config.toml`: presente.
- `npx supabase status`: falha antes de iniciar por não encontrar Docker/Podman.
- Nenhum comando remoto foi usado como substituto.

Os testes pgTAP existentes cobrem RLS/RPC/observabilidade, rollback e idempotência. `approved_draft_catalogs.test.sql` agora também verifica:

- 313 / 165 / 285 / 378 associações;
- 1.141 associações totais e 1.137 skills canônicas;
- nenhum catálogo publicado;
- skills, subjects e aliases órfãos;
- fontes ausentes;
- targets apontando para draft.

Para desbloquear no Windows:

1. Instalar e abrir Docker Desktop com backend WSL 2.
2. Reiniciar o terminal.
3. Confirmar que `docker version` exibe Client e Server.
4. Em `C:\Users\dello\MistakeOS`, executar `npx supabase start`.
5. Executar `npx supabase db reset`.
6. Executar `npx supabase test db`.

## K. Testes do app

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 135 testes passaram; zero falhas.
- `npm run build:web`: passou; export web concluído.
- `git diff --check`: passou; somente avisos de conversão LF/CRLF.
- Testes integrados contra PostgreSQL local e performance real do dispositivo: bloqueados pela ausência do Docker e de um banco local iniciado.

## L. Arquivos alterados nesta validação

- `src/examPrep/repository.ts`: adicionada ordenação explícita por `display_order`.
- `src/supabase/approvedDraftCatalogMigrations.test.ts`: reforçadas contagens estáticas e reutilização canônica.
- `supabase/tests/approved_draft_catalogs.test.sql`: adicionadas contagens e queries de sanidade.
- `scripts/audit-catalogs.mjs`: auditoria acadêmica cruzada reproduzível em Node.
- `docs/reports/catalog-global-academic-audit.md`: relatório global.
- `docs/reports/catalog-professor-final-review.txt`: fila enxuta para professores.
- este relatório.

## M. Riscos restantes

1. Falta executar o ciclo completo de migrations/pgTAP em PostgreSQL limpo.
2. Falta validar os grants/RLS efetivos no banco local, além da análise estática.
3. Falta o teste de concorrência real preparado para observabilidade.
4. Falta testar os quatro catálogos temporariamente publicados somente no banco local.
5. O filtro `.in(skillCodes)` deve ser corrigido antes de considerar segura a experiência com catálogos de 300+ itens em redes/proxies reais.
6. As equivalências acadêmicas listadas precisam de decisão de professor antes de merge.

## N. Veredito

**READY FOR LOCAL VALIDATION**

Ainda não está pronto para revisão de `db push`, pois o `db reset`, pgTAP, RLS efetivo, concorrência e teste integrado do app não puderam ser executados sem Docker.
