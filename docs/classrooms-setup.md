# Turmas acadêmicas — ativação segura

As migrations locais `20260912110000_disable_social_writes.sql` e
`20260912120000_classrooms.sql` ainda não foram aplicadas a nenhum projeto remoto.

Quando a equipe aprovar a publicação, aplique-as primeiro em um projeto Supabase de
staging e valide login, convite, atividade e agregados antes de produção.

## Conceder papel de professor

Não há botão no aplicativo para elevar um usuário. Isso é intencional: somente um
operador autorizado, usando uma sessão administrativa no Supabase, pode conceder o
papel. Depois de confirmar presencialmente ou por um processo institucional a conta
do professor, execute no SQL Editor administrativo:

```sql
insert into public.app_user_roles (user_id, role, granted_by)
values ('UUID-DO-PROFESSOR', 'teacher', auth.uid())
on conflict (user_id) do update
set role = 'teacher', granted_at = now(), granted_by = excluded.granted_by;
```

Nunca exponha `service_role`, nem execute essa operação pelo aplicativo do aluno.
Para revogar, troque `role` para `student` na mesma interface administrativa; as
turmas e dados acadêmicos continuam preservados para auditoria.

## Privacidade do professor

Os RPCs da turma retornam somente nomes da lista de alunos e contagens categóricas
por habilidade. Eles não retornam fotos, enunciados, respostas, textos de erro,
histórico individual, DNA dos Erros ou Índice de Risco pessoal.
