import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const sql = readFileSync('supabase/migrations/20260909120000_exam_prep_catalog.sql','utf8');
test('catalog has canonical many-to-many skills and leaves personal exams intact',()=>{ assert.match(sql,/create table public\.curriculum_skills/i); assert.match(sql,/primary key \(catalog_version_id, skill_code\)/i); assert.doesNotMatch(sql,/alter table public\.exams/i); assert.doesNotMatch(sql,/insert into public\.(curriculum_skills|exam_catalog_skills)/i); });
test('draft catalogs stay hidden and private evidence requires ownership',()=>{ assert.match(sql,/status='published'/i); assert.match(sql,/exam targets own select/i); assert.match(sql,/mistake skill links own select/i); assert.match(sql,/mistake\.user_id=\(select auth\.uid\(\)\)/i); });
test('write RPCs derive identity from auth uid and have safe search paths',()=>{ assert.match(sql,/v_user_id uuid := \(select auth\.uid\(\)\)/i); assert.doesNotMatch(sql,/p_user_id/i); assert.match(sql,/set search_path = ''/i); assert.match(sql,/grant execute on function public\.set_exam_target\(uuid,date\) to authenticated/i); });
