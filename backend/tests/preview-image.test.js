import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {mountGenerations} from '../src/generations.js';
test('Saved PNGs in .local can be served; missing and invalid image IDs fail safely',async()=>{
 const id='e'.repeat(64),file=new URL('../../.local/ai-previews/'+id+'.png',import.meta.url);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await mkdir(new URL('../../.local/ai-previews/',import.meta.url),{recursive:true});await writeFile(file,png);
 const app=express();mountGenerations(app,{collection:()=>({findOne:async()=>null})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base+'/api/generations/'+id+'/image');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/png/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.equal((await fetch(base+'/api/generations/'+'d'.repeat(64)+'/image')).status,404);
  assert.equal((await fetch(base+'/api/generations/not-an-id/image')).status,404);
 }finally{await new Promise(r=>server.close(r));await unlink(file);}
});

test('Generation waits for the provider, survives another app instance, and reuses the saved image',async()=>{
 const collections=new Map();let providerCalls=0,releaseProvider;
 const pendingProvider=new Promise(resolve=>{releaseProvider=resolve;});
 const jpeg=Buffer.from([255,216,255,217]);
 const room={id:'photo',kind:'photo',image:'/assets/rooms/armchair-green-living-room-with-copy-space.jpg'};
 const tile={id:'tile',surfaces:['floor'],image:'/assets/tiles/whiteeza-matt/dior-berry-r1.webp',widthCm:120,heightCm:60,name:'Test Tile',finish:'Matt'};
 function collection(name){
  if(!collections.has(name))collections.set(name,[]);const rows=collections.get(name);
  const matches=(row,filter)=>Object.entries(filter).every(([key,value])=>key.startsWith('$')||row[key]===value);
  return {
   find:()=>({toArray:async()=>rows}),
   findOne:async(filter)=>rows.find(row=>matches(row,filter))||null,
   updateOne:async(filter,update)=>{let row=rows.find(row=>matches(row,filter));if(!row){row={...filter};rows.push(row);}Object.assign(row,update.$set);},
   findOneAndUpdate:async(filter,update)=>{const current=rows.find(row=>row._id===filter._id);if(current&&current.expiresAt>new Date())throw Object.assign(new Error('duplicate lock'),{code:11000});const row=current||{_id:filter._id};Object.assign(row,update.$set);if(!current)rows.push(row);return row;},
   deleteOne:async(filter)=>{const index=rows.findIndex(row=>matches(row,filter));if(index>=0)rows.splice(index,1);}
  };
 }
 collections.set('rooms',[room]);collections.set('tiles',[tile]);
 const db={collection},app=express();app.use(express.json());mountGenerations(app,db);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const originalFetch=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://api.openai.com/v1/images/edits'){
   providerCalls++;assert.equal(options.body.get('output_format'),'jpeg');await pendingProvider;
   return new Response(JSON.stringify({data:[{b64_json:jpeg.toString('base64')}]}),{status:200});
  }
  return originalFetch(url,options);
 };
 const request={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:'photo',design:{floor:{tile:'tile',scale:1,rotation:0,layout:'grid',grout:'#e5dfd2',face:'mixed'}}})};
 try{
  const first=originalFetch(base+'/api/generations',request);
  for(let tries=0;providerCalls===0&&tries<100;tries++)await new Promise(r=>setTimeout(r,10));
  assert.equal(providerCalls,1);
  const secondApp=express();mountGenerations(secondApp,db);
  assert.equal(collections.get('generations')[0].status,'processing');
  const concurrent=await originalFetch(base+'/api/generations',request);assert.equal(concurrent.status,429);
  releaseProvider();const response=await first;assert.equal(response.status,200);const job=await response.json();assert.equal(job.status,'complete');
  const saved=collections.get('generationImages')[0];saved.bytes={buffer:saved.bytes};
  const image=await originalFetch(base+job.imageUrl);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/jpeg/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),jpeg);
  const cached=await (await originalFetch(base+'/api/generations',request)).json();assert.equal(cached.cached,true);assert.equal(providerCalls,1);assert.equal(collections.get('generationLocks').length,0);
 }finally{releaseProvider();globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;await new Promise(r=>server.close(r));}
});
