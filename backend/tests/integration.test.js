import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,access} from 'node:fs/promises';
import {readConfig} from '../src/config.js';
import {connectDatabase} from '../src/database.js';
import {createApp} from '../src/app.js';
import {seedCatalog} from '../scripts/seed.js';
test('Real MongoDB catalogue: seed, read, filter, database changes and outages',async()=>{
 const database='tile_studio_test_'+randomUUID().replaceAll('-','');
 const connection=await connectDatabase({...readConfig(),database});
 const server=createApp(connection.db).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const empty=await fetch(base+'/api/catalog');assert.equal(empty.status,503);
  const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
  await seedCatalog(connection.db,catalog);const again=await seedCatalog(connection.db,catalog);assert.deepEqual(again,{rooms:3,tiles:19});
  const health=await (await fetch(base+'/api/health')).json();assert.equal(health.database,'connected');
  const response=await fetch(base+'/api/catalog');assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.rooms.length,3);assert.equal(data.tiles.length,19);assert.equal(data.tiles.reduce((n,t)=>n+t.variants.length,0),62);assert.equal(data.tiles[0]._id,undefined);
  for(const tile of data.tiles)for(const asset of [tile.thumbnail,...tile.variants])await access(new URL('../../frontend/public'+asset,import.meta.url));
  const dior=await (await fetch(base+'/api/tiles?surface=floor&collection=Dior')).json();assert.equal(dior.length,4);
  assert.equal((await fetch(base+'/api/tiles?surface=ceiling')).status,400);
  assert.equal((await fetch(base+'/api/tiles/unknown')).status,404);
  await connection.db.collection('tiles').updateOne({id:'dior-berry'},{$set:{name:'Database proof'}});
  assert.equal((await (await fetch(base+'/api/tiles/dior-berry')).json()).name,'Database proof');
 }finally{
  if(!database.startsWith('tile_studio_test_'))throw new Error('Refusing to remove a non-test database');
  await connection.db.dropDatabase();await connection.client.close();
  try{assert.equal((await fetch(base+'/api/health')).status,503);assert.equal((await fetch(base+'/api/catalog')).status,503)}finally{await new Promise(resolve=>server.close(resolve))}
 }
});
