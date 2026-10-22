import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {mountGenerations} from '../src/generations.js';
test('Saved PNGs in .local can be served; missing and invalid image IDs fail safely',async()=>{
 const id='e'.repeat(64),file=new URL('../../.local/ai-previews/'+id+'.png',import.meta.url);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await mkdir(new URL('../../.local/ai-previews/',import.meta.url),{recursive:true});await writeFile(file,png);
 const app=express();mountGenerations(app,{collection:()=>({updateMany:async()=>({})})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base+'/api/generations/'+id+'/image');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/png/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.equal((await fetch(base+'/api/generations/'+'d'.repeat(64)+'/image')).status,404);
  assert.equal((await fetch(base+'/api/generations/not-an-id/image')).status,404);
 }finally{await new Promise(r=>server.close(r));await unlink(file);}
});
