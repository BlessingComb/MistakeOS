// Browser-only fixtures: all external requests are intercepted. Never writes to Supabase.
// Run from the repository root after npm run build:web. See docs/reports/mobile-web-responsiveness.md.
const { chromium } = require('../tmp/responsive-tools/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve('dist');
const output = path.resolve('tmp/responsive-results');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const id = '00000000-0000-4000-8000-000000000099';
const stamp = new Date().toISOString();
const catalog = { id, stage: '2ª Etapa', cycle: 'Projeto 2028', exam_year: 2027, project_year: 2028, source_year: 2026, source_document: 'Layout fixture', document_version: 'fixture', catalog_version: 'fixture', source_url: 'https://example.invalid', exam_programs: { code: 'psc', name: 'Processo Seletivo Contínuo — PSC', institution: 'Universidade Federal do Amazonas — UFAM' } };
const skill = { code: 'math.progressions', subject_code: 'mathematics', name_pt_br: 'Progressões geométricas e suas aplicações em problemas contextualizados', name_en: 'Geometric progressions and applications to contextual problems', academic_subjects: { name_pt_br: 'Matemática', name_en: 'Mathematics' } };
const mockClass = { id, name: 'Turma de preparação PSC — segundo ano', role: 'teacher', catalog_version_id: id, catalog_label: 'PSC 2ª Etapa — Projeto 2028', teacher_name: 'Layout Fixture', member_count: 12, invite_code: 'LAYOUT', objective: 'Revisar habilidades em preparação para provas' };
let full = true;
async function intercept(route) {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1') return route.continue();
  let data = [];
  const name = url.pathname.split('/').at(-1);
  if (name === 'exam_catalog_versions') data = full ? [catalog] : [];
  if (name === 'user_exam_targets') data = full ? { id, catalog_version_id: id } : null;
  if (name === 'exam_catalog_skills') data = [{ skill_code: skill.code, curriculum_skills: skill }];
  if (name === 'mistake_skill_links') data = [0,1,2].map(n => ({ mistake_id: id.slice(0,-1)+n, skill_code: skill.code, link_source: 'reviewed', confirmed_at: stamp, mistakes: { id: id.slice(0,-1)+n, created_at: stamp } }));
  if (name === 'list_my_classrooms') data = full ? [mockClass] : [];
  if (name === 'get_my_app_role') data = 'teacher';
  if (name === 'list_classroom_assignments') data = [{ id, skill_code: skill.code, skill_name: skill.name_pt_br, title: 'Atividade de revisão de progressões geométricas', created_at: stamp }];
  if (name === 'get_classroom_skill_summary') data = [{ skill_code: skill.code, skill_name: skill.name_pt_br, subject_name: 'Matemática', at_risk_count: 3, learning_count: 4, mastered_count: 2, not_assessed_count: 3 }];
  if (name === 'get_practice_questions_for_skill') data = [0,1,2].map(n => ({ question_id: id.slice(0,-1)+n, statement: 'QUESTÃO FICTÍCIA EXCLUSIVA DO TESTE DE LAYOUT. Considere uma progressão geométrica e identifique a alternativa que corresponde ao raciocínio apresentado no enunciado.', alternatives: ['Alternativa de teste com um texto longo para verificar quebra de linha.', 'Segunda alternativa de teste', 'Terceira alternativa de teste'], source_type: 'generated', source_label: 'Layout fixture' }));
  if (name === 'mistakes') data = full ? [{ id, client_id: 'fixture', subject: 'mathematics', note: 'Questão fictícia exclusiva do teste visual.', created_at: stamp, source: 'manual' }] : [];
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
}
async function metrics(page, screen, width, language) {
  await page.waitForTimeout(350);
  const result = await page.evaluate(() => {
    const w = innerWidth;
    const overflowing = [...document.querySelectorAll('#root *')].flatMap(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || (r.left >= -1 && r.right <= w + 1)) return [];
      // Decorative shapes are intentionally clipped by their own frame.
      let parent = el.parentElement;
      while (parent && parent.id !== 'root') {
        const p = parent.getBoundingClientRect();
        if (getComputedStyle(parent).overflowX === 'hidden' && getComputedStyle(parent).pointerEvents === 'none' && p.left >= 0 && p.right <= w) return [];
        parent = parent.parentElement;
      }
      return [{ text: (el.getAttribute('aria-label') || el.textContent || '').slice(0,65), x: Math.round(r.x), right: Math.round(r.right), width: Math.round(r.width) }];
    });
    const tabs = [...document.querySelectorAll('[role="tab"]')].map(el => { const r = el.getBoundingClientRect(); return { x:r.x, right:r.right, width:r.width }; });
    return { viewport:w, documentWidth:document.documentElement.scrollWidth, bodyBackground:getComputedStyle(document.body).backgroundColor, overflowing, tabs };
  });
  records.push({ screen, width, language, ...result });
  if (result.overflowing.length || result.documentWidth > width) console.log('OVERFLOW', screen, width, language, JSON.stringify(result.overflowing.slice(0,4)));
  if ((screen === 'home' || [320,390,1440].includes(width)) && language === 'pt-BR') await page.screenshot({ path: path.join(output, `${screen}-${width}.png`) });
}
const records = [];
(async () => {
  await new Promise(resolve => server.listen(4178, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
  try {
    for (const language of ['pt-BR','en']) {
      const context = await browser.newContext({ locale:language, reducedMotion:'reduce' });
      await context.route('**/*', intercept);
      await context.addInitScript(({ id, language }) => {
        localStorage.setItem('@mistakeos/intro:v1','seen');
        localStorage.setItem('@mistakeos/language:v1',language);
        const payload = btoa(JSON.stringify({ sub:id, exp: Math.floor(Date.now()/1000)+86400, role:'authenticated' }));
        localStorage.setItem('sb-wkwcwnmklksuyswajees-auth-token', JSON.stringify({ access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, refresh_token:'fixture', expires_at:Math.floor(Date.now()/1000)+86400, expires_in:86400, token_type:'bearer', user:{ id, email:'estudante.layout@example.invalid', role:'authenticated', app_metadata:{}, user_metadata:{} } }));
      }, { id, language });
      const page = await context.newPage();
      page.on('pageerror', error => console.log('PAGE_ERROR',error.message));
      for (const [width,height] of [[320,700],[360,800],[375,812],[390,844],[412,915],[430,932],[768,1024],[1440,900]]) {
        await page.setViewportSize({width,height});
        full=true;
        await page.goto('http://127.0.0.1:4178');
        await page.getByRole('tab').first().waitFor({timeout:20000});
        await page.getByText(language==='pt-BR' ? 'Acesso rápido' : 'Quick access',{exact:false}).first().waitFor();
        await metrics(page,'home',width,language);
        if ([320,390,1440].includes(width) && language === 'pt-BR') {
          await page.getByText('Acesso rápido',{exact:true}).scrollIntoViewIfNeeded();
          await page.evaluate(() => { for (const el of document.querySelectorAll('#root *')) if (getComputedStyle(el).overflowY === 'auto') el.scrollTop = el.scrollHeight; });
          await page.screenshot({path:path.join(output,`quick-actions-${width}.png`)});
        }
        await page.getByRole('tab').nth(1).click(); await metrics(page,'mistakes',width,language);
        await page.getByRole('tab').nth(2).click(); await metrics(page,'preparation',width,language);
        const train = page.getByRole('button',{name:language==='pt-BR'?'Treinar pontos fracos':'Train weak points',exact:true});
        if (await train.count()) { await train.click(); await metrics(page,'practice',width,language); }
        await page.getByRole('tab').nth(3).click(); await metrics(page,'classrooms',width,language);
        const classroom = page.getByText(mockClass.name,{exact:true});
        if (await classroom.count()) { await classroom.click(); await metrics(page,'teacher',width,language); }
        await page.getByRole('tab').nth(4).click(); await metrics(page,'settings',width,language);
        await page.getByRole('tab').first().click();
        await page.getByRole('button',{name:language==='pt-BR'?'Registrar um erro':'Log a mistake',exact:true}).last().click();
        await metrics(page,'register',width,language);
      }
      full=false;
      await page.goto('http://127.0.0.1:4178');
      await page.getByRole('tab').first().waitFor();
      for (const width of [320,360,390,412,430,768,1440]) {
        await page.setViewportSize({width,height:844});
        await metrics(page,'home-empty',width,language);
      }
      await context.close();
      const visitor = await browser.newContext({locale:language,reducedMotion:'reduce'});
      await visitor.route('**/*',intercept);
      await visitor.addInitScript(language=>{localStorage.setItem('@mistakeos/intro:v1','seen');localStorage.setItem('@mistakeos/language:v1',language);},language);
      const login = await visitor.newPage();
      for (const width of [320,360,375,390,412,430,768,1440]) {
        await login.setViewportSize({width,height:844});
        await login.goto('http://127.0.0.1:4178');
        await login.getByText(language==='pt-BR'?'Entrar':'Sign in',{exact:true}).click();
        await metrics(login,'login',width,language);
        await login.getByText(language==='pt-BR'?'Novo no MistakeOS? Criar conta':'New to MistakeOS? Create account',{exact:true}).click();
        await metrics(login,'signup',width,language);
      }
      await visitor.close();
    }
  } finally {
    fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(records,null,2));
    await browser.close(); server.close();
    const failures = records.filter(r=>r.documentWidth>r.width||r.overflowing.length||r.tabs.some(tab=>tab.x<0||tab.right>r.width));
    console.log('MEASUREMENTS',records.length,'FAILURES',failures.length);
    if (failures.length) process.exitCode = 1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
