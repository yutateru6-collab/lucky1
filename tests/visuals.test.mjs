import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TEMPLATES, TEMPLATE_CATEGORIES, filterTemplates, memoArt} from '../public/visuals.mjs';
import {GAMES} from '../public/games.mjs';
import {needsHumanJudgment} from '../public/decision.mjs';
test('templates are unique, actionable yes/no questions, not seeded records',()=>{
 assert.equal(TEMPLATES.length,new Set(TEMPLATES.map(t=>t.id)).size);
 for(const t of TEMPLATES){assert.ok(Object.hasOwn(GAMES,t.method));assert.ok(TEMPLATE_CATEGORIES.includes(t.category));assert.match(t.note,/？$/u);assert.ok(t.note.length<=240);assert.equal(needsHumanJudgment(t.note),false)}
});
test('search combines category and normalized terms',()=>{
 assert.equal(filterTemplates('カフェ').length,1);
 assert.equal(filterTemplates('カフェ','おでかけ').length,0);
 assert.equal(filterTemplates('  ランチ  ','ごはん').length,2);
 assert.equal(filterTemplates('存在しない言葉').length,0);
 assert.equal(filterTemplates('').length,TEMPLATES.length);
});
test('note illustration follows the content',()=>{
 assert.equal(memoArt('どっちの服を着る？'),'shirt');assert.equal(memoArt('公園を散歩する？'),'plane');assert.equal(memoArt('カフェへ'),'coffee');assert.equal(memoArt(),'cloud');
});
test('reference art ships as a bounded real WebP, not an external dependency',async()=>{
 const b=await readFile(new URL('../public/art/lucky-reference.webp',import.meta.url));
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.ok(b.length<100000);
 const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');assert.match(css,/art\/lucky-reference\.webp/);assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
