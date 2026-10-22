import {mountGenerations} from './generations.js';
import express from 'express';
import {fileURLToPath} from 'node:url';
const publicFields={projection:{_id:0}};
export function createApp(db){
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));mountGenerations(app,db);
 app.get('/api/health',async(_req,res)=>{try{await db.command({ping:1});res.json({status:'ok',database:'connected',storage:'mongodb'})}catch{res.status(503).json({status:'unavailable',database:'disconnected'})}});
 app.get('/api/catalog',async(_req,res)=>{
  const [rooms,tiles,metadata]=await Promise.all([db.collection('rooms').find({},publicFields).sort({id:1}).toArray(),db.collection('tiles').find({},publicFields).sort({name:1}).toArray(),db.collection('metadata').findOne({id:'catalog'},publicFields)]);
  if(!rooms.length||!tiles.length)return res.status(503).json({error:'Catalogue is empty. Run npm run db:seed from the project root.'});
  res.json({rooms,tiles,collection:metadata?.collection||null});
 });
 app.get('/api/rooms',async(_req,res)=>res.json(await db.collection('rooms').find({},publicFields).sort({id:1}).toArray()));
 app.get('/api/tiles',async(req,res)=>{
  const {surface,collection}=req.query;
  if(surface!==undefined&&!['floor','wall'].includes(surface))return res.status(400).json({error:'surface must be floor or wall.'});
  if(collection!==undefined&&(typeof collection!=='string'||collection.length>80))return res.status(400).json({error:'collection must be a short text value.'});
  const filter={};if(surface)filter.surfaces=surface;if(collection)filter.collection=collection;
  res.json(await db.collection('tiles').find(filter,publicFields).sort({name:1}).toArray());
 });
 app.get('/api/tiles/:id',async(req,res)=>{const tile=await db.collection('tiles').findOne({id:req.params.id},publicFields);if(!tile)return res.status(404).json({error:'Tile not found.'});res.json(tile)});
 app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
 app.use(express.static(fileURLToPath(new URL('../../frontend/dist',import.meta.url))));
 app.get('/{*path}',(_req,res)=>res.sendFile(fileURLToPath(new URL('../../frontend/dist/index.html',import.meta.url))));
 app.use((error,_req,res,_next)=>{if(res.headersSent)return;const missing=error.code==='ENOENT';res.status(missing?404:503).json({error:missing?'Frontend build not found. Run npm run build, or use npm run dev.':'Database request failed. Check MongoDB and try again.'})});
 return app;
}
