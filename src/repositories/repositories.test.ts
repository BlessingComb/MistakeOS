import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createExam } from '../exams/core';
import { ExamStore } from '../exams/storage';
import { createMistake } from '../mistakes/core';
import { MistakeStore } from '../mistakes/storage';
import { ExamRepository, MistakeRepository } from '.';
function memory(){const values=new Map<string,string>();return{getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);}};}
it('repositories preserve local fallback when Supabase is unavailable',async()=>{const mistakeStore=new MistakeStore(memory());const examStore=new ExamStore(memory());const mistakes=new MistakeRepository(mistakeStore,null);const exams=new ExamRepository(examStore,null);const mistake=createMistake({subject:'mathematics',note:'sign error'});const exam=createExam({subject:'mathematics',date:'2026-09-01',notes:'algebra'});await mistakes.add(mistake);await exams.add(exam);assert.equal((await mistakes.load())[0].id,mistake.id);assert.equal((await exams.load())[0].id,exam.id);});
