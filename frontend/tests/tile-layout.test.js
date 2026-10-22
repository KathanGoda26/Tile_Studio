import test from 'node:test';
import assert from 'node:assert/strict';
import {tileGeometry,faceIndex} from '../src/tile-layout.js';
const tile={widthCm:120,heightCm:60},surface={meters:[5,5]};
test('Rectangular products keep their 2:1 shape and rotate into a 1:2 grid cell',()=>{
 const a=tileGeometry(tile,surface,{rotation:0,scale:1}),b=tileGeometry(tile,surface,{rotation:90,scale:1});
 assert.equal(a.width/a.height,2);assert.equal(b.width/b.height,.5);assert.equal(a.width,b.height);assert.equal(a.height,b.width);
 const c=tileGeometry(tile,surface,{rotation:270,scale:2});assert.equal(c.width,b.width*2);assert.equal(c.height,b.height*2);
});
test('Mixing reaches every face, remains stable, and manual faces override mixing',()=>{
 const result=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const i=faceIndex(r,c,4);assert.ok(i>=0&&i<4);assert.equal(i,faceIndex(r,c,4));result.push(i)}
 assert.equal(new Set(result).size,4);assert.equal(faceIndex(3,4,4,'2'),2);assert.equal(faceIndex(4,5,1),0);
});
