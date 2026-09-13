import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reports = path.join(root, 'docs', 'reports');

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const singularKey = (value) => normalize(value).split(' ').map((word) => word.length > 5 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word).join(' ');

function parseReport(catalog, filename) {
  return fs.readFileSync(path.join(reports, filename), 'utf8').split(/\r?\n/).flatMap((line) => {
    if (!/^\|\s*\d+\s*\|/.test(line)) return [];
    const fields = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((field) => field.trim().replaceAll('\\|', '|'));
    if (fields.length < 6) return [];
    return [{ catalog, code: fields[1], name: fields[2], source: fields[3], classification: fields[5].replaceAll('**', '') }];
  });
}

function similarity(a, b) {
  const rows = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = rows[0];
    rows[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const previous = rows[j];
      rows[j] = a[i - 1] === b[j - 1] ? diagonal : 1 + Math.min(diagonal, rows[j], rows[j - 1]);
      diagonal = previous;
    }
  }
  return 1 - rows[b.length] / Math.max(1, a.length, b.length);
}

const confidence = (score) => score >= 0.97 ? 'HIGH' : score >= 0.90 ? 'MEDIUM-HIGH' : 'MEDIUM';

function recommendation(a, b, score) {
  if (normalize(a.name) === normalize(b.name)) return 'MERGE RECOMMENDED';
  if (singularKey(a.name) === singularKey(b.name)) return 'MERGE RECOMMENDED';
  const source = normalize(`${a.source} ${b.source}`);
  const as = normalize(a.source);
  const bs = normalize(b.source);
  const distinctDisciplines =
    (as.includes('fisica') && bs.includes('biologia')) || (as.includes('biologia') && bs.includes('fisica')) ||
    (as.includes('geografia') && ['fisica', 'biologia', 'quimica'].some((v) => bs.includes(v))) ||
    (bs.includes('geografia') && ['fisica', 'biologia', 'quimica'].some((v) => as.includes(v)));
  if (distinctDisciplines && ['energia', 'investigacao', 'ambiente', 'grafico', 'tecnologia'].some((v) => source.includes(v))) return 'KEEP SEPARATE';
  return score >= 0.88 ? 'PROFESSOR REVIEW' : 'KEEP SEPARATE';
}

function findCandidates(skills) {
  const candidates = [];
  for (let index = 0; index < skills.length; index += 1) {
    const a = skills[index];
    const an = normalize(a.name);
    const aw = new Set(an.split(' '));
    for (const b of skills.slice(index + 1)) {
      if (a.catalog === b.catalog || a.code === b.code) continue;
      const bn = normalize(b.name);
      const ratio = an.length / Math.max(1, bn.length);
      if (ratio < 0.5 || ratio > 2) continue;
      const bw = new Set(bn.split(' '));
      const overlap = [...aw].filter((word) => bw.has(word)).length / Math.max(1, Math.min(aw.size, bw.size));
      let score;
      let reason;
      if (an === bn) {
        score = 1;
        reason = 'Nomes equivalentes após normalização de acentuação e pontuação';
      } else if (singularKey(a.name) === singularKey(b.name)) {
        score = 0.97;
        reason = 'Diferença somente de singular/plural ou flexão superficial';
      } else if (overlap >= 0.72) {
        score = similarity(an, bn);
        if (score < 0.84) continue;
        reason = `Alta sobreposição terminológica (${Math.round(overlap * 100)}%)`;
      } else continue;
      candidates.push({ a, b, score, reason });
    }
  }
  return candidates.sort((left, right) => right.score - left.score || left.a.catalog.localeCompare(right.a.catalog) || left.a.name.localeCompare(right.a.name));
}

const skills = [
  ...parseReport('PSC 1', 'psc1-academic-validation.md'),
  ...parseReport('PSC 2', 'psc2-academic-validation.md'),
  ...parseReport('PSC 3', 'psc3-academic-validation.md'),
  ...parseReport('ENEM', 'enem-2026-academic-validation.md'),
];
const expected = { 'PSC 1': 313, 'PSC 2': 165, 'PSC 3': 285, ENEM: 378 };
const actual = Object.fromEntries(Object.keys(expected).map((catalog) => [catalog, skills.filter((skill) => skill.catalog === catalog).length]));
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Unexpected report counts: ${JSON.stringify(actual)}`);

const candidates = findCandidates(skills);
const byClass = (value) => skills.filter((skill) => skill.classification === value);
const review = byClass('REVIEW RECOMMENDED');
const possible = byClass('POSSIBLE DUPLICATE');
const ambiguity = byClass('SOURCE AMBIGUITY');
const errors = byClass('ERROR');

const lines = [
  '# Auditoria acadêmica global dos catálogos', '',
  '> Revisão local e não destrutiva. Nenhuma skill foi mesclada ou alterada.', '',
  '## Contagens verificadas', '',
  ...Object.entries(actual).map(([catalog, count]) => `- ${catalog}: ${count}`),
  `- Associações avaliáveis totais: ${skills.length}.`,
  `- Códigos canônicos únicos: ${new Set(skills.map((skill) => skill.code)).size}.`, '',
  '## Equivalências e semelhanças entre catálogos', '',
  '| Catálogo A | Skill A | Catálogo B | Skill B | Motivo | Confiança | Recomendação |',
  '|---|---|---|---|---|---|---|',
];
for (const { a, b, score, reason } of candidates) {
  const values = [a.catalog, `${a.code} — ${a.name}`, b.catalog, `${b.code} — ${b.name}`, reason, confidence(score), recommendation(a, b, score)];
  lines.push(`| ${values.map((value) => value.replaceAll('|', '\\|')).join(' | ')} |`);
}
function appendItems(title, values) {
  lines.push('', `## ${title} (${values.length})`, '');
  lines.push(...(values.length ? values.map((skill) => `- **${skill.catalog} · ${skill.code}** — ${skill.name} — ${skill.source}`) : ['- Nenhum.']));
}
appendItems('POSSIBLE DUPLICATE', possible);
appendItems('SOURCE AMBIGUITY', ambiguity);
appendItems('REVIEW RECOMMENDED', review);
appendItems('ERROR', errors);
lines.push('', '## Pares parecidos que devem permanecer distintos', '',
  '- Fontes de energia em Física, Biologia e Geografia: o objeto muda conforme mecanismo físico, impacto biológico ou organização territorial.',
  '- Investigação científica em Física, Química e Biologia: os métodos e unidades de evidência são disciplinares.',
  '- Leitura de gráficos em Matemática, Física e Linguagens: a operação cognitiva é semelhante, mas o conteúdo avaliado e a evidência de erro são diferentes.',
  '- Meio ambiente em Biologia, Química e Geografia: não deve virar uma skill genérica única.');
fs.writeFileSync(path.join(reports, 'catalog-global-academic-audit.md'), `${lines.join('\n')}\n`);

const professor = ['REVISÃO FINAL PARA PROFESSORES — PSC 1 / PSC 2 / PSC 3 / ENEM', '', 'Nenhuma alteração será aplicada automaticamente.', '', '1. EQUIVALÊNCIAS ENTRE CATÁLOGOS', ''];
for (const { a, b, score, reason } of candidates) {
  const decision = recommendation(a, b, score);
  if (decision === 'KEEP SEPARATE') continue;
  professor.push(`[${decision} · ${confidence(score)}]`, `${a.catalog}: ${a.code} — ${a.name}`, `${b.catalog}: ${b.code} — ${b.name}`, `Motivo: ${reason}`, '');
}
for (const [heading, values] of [['2. POSSIBLE DUPLICATE', possible], ['3. SOURCE AMBIGUITY', ambiguity], ['4. TÓPICOS COMPOSTOS / REVIEW RECOMMENDED', review]]) {
  professor.push(heading, '', ...values.map((skill) => `${skill.catalog}: ${skill.code} — ${skill.name} — ${skill.source}`), '');
}
fs.writeFileSync(path.join(reports, 'catalog-professor-final-review.txt'), `${professor.join('\n')}\n`);
console.log(JSON.stringify({ associations: skills.length, canonical_codes: new Set(skills.map((skill) => skill.code)).size, cross_catalog_candidates: candidates.length, review: review.length, possible_duplicates: possible.length, source_ambiguities: ambiguity.length, errors: errors.length }));
