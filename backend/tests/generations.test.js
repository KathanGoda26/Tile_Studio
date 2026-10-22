import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDesign,buildPrompt} from '../src/generations.js';
const tiles=[{id:'tile',surfaces:['floor','wall'],widthCm:120,heightCm:60,name:'Test Tile',finish:'Matt',image:'/tile.webp'}];
const setting={tile:'tile',scale:1,rotation:90,layout:'brick',grout:'#e5dfd2',face:'mixed'};
test('AI settings reject unknown assets, invalid scales and unbounded face indices',()=>{
 for(const patch of [{tile:'../secret'},{scale:100},{face:'7'},{grout:'anything'},{rotation:12}])assert.throws(()=>validateDesign({floor:{...setting,...patch},wall:setting},tiles));
});
test('Floor-only prompt preserves walls and ignores supplied wall settings',()=>{
 const design=validateDesign({floor:setting,wall:{...setting,scale:.5}},tiles);const prompt=buildPrompt(design,tiles);
 assert.match(prompt,/120 by 60/);assert.equal(design.wall,undefined);assert.match(prompt,/Preserve all original walls/);assert.match(prompt,/half tile brick offset/);assert.doesNotMatch(prompt,/reference image 3/);assert.match(prompt,/Keep the camera/);
});
