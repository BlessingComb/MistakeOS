import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  'supabase/migrations/20260909121000_psc_2027_stage_2_draft.sql',
  'utf8',
);

const importValues = sql.slice(
  sql.indexOf('insert into psc2_catalog_import'),
  sql.indexOf('insert into public.curriculum_skills'),
);
const topicRows = [...importValues.matchAll(/^  \('([^']+)','([^']+)','([^']+)','([^']+)',(\d+)\)[,;]/gm)].map(
  ([, code, subject, label, sourceLocator, order]) => ({
    code,
    subject,
    label,
    sourceLocator,
    order: Number(order),
  }),
);

test('PSC pilot remains a local draft with exact approved provenance', () => {
  assert.match(sql, /'psc','2ª Etapa','Projeto 2028',2027,2028/);
  assert.match(sql, /'Edital 14 de 2026 \[Consolidado\]'/);
  assert.match(sql, /https:\/\/edoc\.ufam\.edu\.br\/handle\/123456789\/12242/);
  assert.match(sql, /'psc-2027-stage-2-project-2028-v1','draft',now\(\),null/);
  assert.doesNotMatch(sql, /'published',now\(\),now\(\)/);
});

test('PSC pilot imports the audited Annex 1 hierarchy and counts', () => {
  assert.equal(topicRows.length, 165);
  const counts = Object.fromEntries(
    [...new Set(topicRows.map(({ subject }) => subject))].map((subject) => [
      subject,
      topicRows.filter((row) => row.subject === subject).length,
    ]),
  );
  assert.deepEqual(counts, {
    portuguese_literature: 35,
    history: 37,
    geography: 32,
    biology: 13,
    chemistry: 17,
    physics: 15,
    mathematics: 16,
  });
  assert.equal(new Set(topicRows.map(({ code }) => code)).size, 165);
  assert.equal(new Set(topicRows.map(({ label }) => label.toLocaleLowerCase('pt-BR'))).size, 165);
});

test('every imported topic has source traceability and no orphan subject', () => {
  const subjects = new Set([
    'portuguese_literature',
    'history',
    'geography',
    'biology',
    'chemistry',
    'physics',
    'mathematics',
  ]);
  for (const row of topicRows) {
    assert.ok(subjects.has(row.subject), `${row.code} has a known subject`);
    assert.match(row.sourceLocator, /^Anexo 1, pp?\. (16|17|18|19|20|21)/);
    assert.ok(row.label.trim().length > 0);
    assert.ok(Number.isInteger(row.order));
  }
});

test('canonical aliases reuse skills instead of duplicating concepts', () => {
  assert.match(sql, /\('pa','math\.arithmetic-progressions'\)/);
  assert.match(sql, /\('pg','math\.geometric-progressions'\)/);
  assert.match(sql, /\('zfm','geography\.brazil-industrialization-zfm'\)/);
  assert.match(sql, /\('zee','geography\.brazil-maritime-borders'\)/);
  assert.match(sql, /\('rmm','geography\.brazil-amazonas-urbanization'\)/);
  assert.match(sql, /on conflict \(normalized_alias\) do nothing/i);
});

test('migration performs pre-publication integrity checks', () => {
  assert.match(sql, /v_subjects <> 7/);
  assert.match(sql, /v_skills <> 165/);
  assert.match(sql, /PSC2_IMPORT_DUPLICATE_LABELS/);
  assert.match(sql, /PSC2_IMPORT_MISSING_TRACEABILITY/);
  assert.match(sql, /PSC2_IMPORT_MUST_REMAIN_DRAFT/);
});
