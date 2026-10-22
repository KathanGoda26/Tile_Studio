import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {startBackend} from '../src/start-backend.js';
test('A duplicate launch never opens the database or changes jobs',async()=>{
 const existing=createServer((_req,res)=>res.end('existing backend'));existing.listen(0,'127.0.0.1');await new Promise(r=>existing.once('listening',r));
 let connected=false;
 try{
  await assert.rejects(startBackend({port:existing.address().port,host:'127.0.0.1'},{connectDatabase:async()=>{connected=true;},createApp:()=>assert.fail('must not initialize jobs')}),{code:'EADDRINUSE'});
  assert.equal(connected,false);assert.equal(await (await fetch('http://127.0.0.1:'+existing.address().port)).text(),'existing backend');
 }finally{await new Promise(r=>existing.close(r));}
});
test('Successful startup responds and repeated shutdown closes database once',async()=>{
 let closes=0;const backend=await startBackend({port:0,host:'127.0.0.1'},{connectDatabase:async()=>({db:{},client:{close:async()=>{closes++;}}}),createApp:()=>((_req,res)=>res.end('ready'))});
 assert.equal(await (await fetch('http://127.0.0.1:'+backend.server.address().port)).text(),'ready');
 await Promise.all([backend.close(),backend.close()]);assert.equal(closes,1);
});
