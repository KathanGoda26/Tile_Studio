import test from 'node:test';import assert from 'node:assert/strict';import {homography} from '../src/perspective.js';
test('Perspective maps the four unit corners exactly onto the floor',()=>{const q=[[260,410],[840,410],[1100,760],[0,760]],p=homography(q);[[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>p(u,v).forEach((n,j)=>assert.ok(Math.abs(n-q[i][j])<1e-6)))});
test('Perspective floor tiles become wider near the viewer',()=>{const p=homography([[260,410],[840,410],[1100,760],[0,760]]);assert.ok(p(.6,1)[0]-p(.4,1)[0]>p(.6,0)[0]-p(.4,0)[0])});
test('Rectangular wall remains rectangular',()=>{const p=homography([[0,0],[500,0],[500,300],[0,300]]);assert.deepEqual(p(.5,.5),[250,150])});
test('Rejects a collapsed surface',()=>assert.throws(()=>homography([[0,0],[1,0],[2,0],[3,0]])));
