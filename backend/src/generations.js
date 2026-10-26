import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const assets=fileURLToPath(new URL('../../frontend/public',import.meta.url));
const output=fileURLToPath(new URL('../../.local/ai-previews',import.meta.url));
// Wall tiling is paused. Restore 'wall' here and its prompt/reference instructions to re-enable.
const enabledSurfaces=['floor'];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function validateDesign(design,tiles){
 const clean={};
 for(const surface of enabledSurfaces){
  const s=design?.[surface];const tile=tiles.find(t=>t.id===s?.tile&&t.surfaces.includes(surface));
  if(!tile||![.5,.75,1,1.25,1.5,1.75,2].includes(s.scale)||![0,90,180,270].includes(s.rotation)||!['grid','brick'].includes(s.layout)||!/^#[0-9a-f]{6}$/i.test(s.grout)||!(s.face==='mixed'||/^\d+$/.test(String(s.face))&&Number(s.face)<(tile.variants?.length||1)))throw fail('Choose valid tile and layout settings.');
  clean[surface]={tile:s.tile,scale:s.scale,rotation:s.rotation,layout:s.layout,grout:s.grout,face:String(s.face)};
 }
 return clean;
}
export function buildPrompt(design,tiles){
 return 'Edit IMAGE 1, the original room photograph. Keep the camera, framing, architecture, furniture, plants, thin legs, rugs and all decor unchanged. Replace only exposed floor finishes. Preserve all original walls, wall colours, wall textures, niches and wall finishes exactly as photographed. Preserve objects and gaps between legs with realistic occlusion, contact shadows, reflections and lighting. Do not add objects or text. Keep the original aspect ratio. Image 2 is the product reference for the floor only. Do not apply tiles to walls. Match their actual texture and colour; repeat rectangular tiles in perspective. Dimensions are approximate demo dimensions, not measured room geometry. '+enabledSurfaces.map((surface,i)=>{const s=design[surface],t=tiles.find(t=>t.id===s.tile);return `${surface}: reference image ${i+2}, ${t.name}, ${t.finish}, ${t.widthCm*s.scale} by ${t.heightCm*s.scale} cm, ${s.layout==='brick'?'half tile brick offset':'straight grid'}, rotation ${s.rotation} degrees, thin grout ${s.grout}, texture faces ${s.face==='mixed'?'natural subtle variation':'use supplied face consistently'}.`;}).join(' ');
}
async function asset(url){
 const p=path.resolve(assets,'.'+url);if(!url.startsWith('/assets/')||!p.startsWith(assets+path.sep))throw fail('Invalid asset.');
 if(process.env.VERCEL){
  const host=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
  if(!host)throw fail('The server asset URL is not configured.',503);
  const response=await fetch(new URL(url,`https://${host}`),{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw fail('The room or tile reference image could not be loaded.',503);
  return Buffer.from(await response.arrayBuffer());
 }
 return readFile(p);
}
export function mountGenerations(app,db){
 const jobs=db.collection('generations'),images=db.collection('generationImages'),locks=db.collection('generationLocks');
 app.get('/api/ai/status',(_req,res)=>res.json({configured:Boolean(process.env.OPENAI_API_KEY?.trim())}));
 app.get('/api/generations/:id',async(req,res)=>{if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.status(404).json({error:'Preview not found.'});const job=await jobs.findOne({id:req.params.id},{projection:{_id:0}});if(!job)return res.status(404).json({error:'Preview not found.'});if(job.status==='processing'&&Date.now()-new Date(job.createdAt).getTime()>300000){job.status='failed';job.error='Generation timed out. Please generate again.';await jobs.updateOne({id:job.id,status:'processing'},{$set:{status:job.status,error:job.error}});}res.json(job)});
 app.get('/api/generations/:id/image',async(req,res)=>{
  if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.sendStatus(404);
  const image=await images.findOne({_id:req.params.id});
  if(image){res.set('Cache-Control','public, max-age=31536000, immutable');return res.type(image.contentType).send(Buffer.isBuffer(image.bytes)?image.bytes:Buffer.from(image.bytes.buffer));}
  if(process.env.VERCEL)return res.status(404).json({error:'Preview not found.'});
  res.sendFile(path.join(output,req.params.id+'.png'),{dotfiles:'allow'},error=>{if(error&&!res.headersSent)res.status(error.code==='ENOENT'?404:500).json({error:'The saved preview could not be loaded.'});});
 });
 app.post('/api/generations',async(req,res)=>{
  try{
   if(!process.env.OPENAI_API_KEY?.trim())throw fail('AI preview is not configured on the server.',503);
   if(typeof req.body?.roomId!=='string'||req.body.roomId.length>80)throw fail('Choose a valid photo room.');
   const room=await db.collection('rooms').findOne({id:req.body?.roomId,kind:'photo'});if(!room)throw fail('Choose a photo room.');
   const tiles=await db.collection('tiles').find({}).toArray(),design=validateDesign(req.body.design,tiles);
   const model=process.env.OPENAI_IMAGE_MODEL||'gpt-image-1.5';
   const id=createHash('sha256').update(JSON.stringify({version:3,room:room.id,image:room.image,model,design})).digest('hex');
   const previous=await jobs.findOne({id});
   if(previous?.status==='complete'&&await images.findOne({_id:id},{projection:{_id:1}}))return res.json({id,status:'complete',imageUrl:`/api/generations/${id}/image`,cached:true});
   const owner=randomUUID(),now=new Date();
   try{
    const lock=await locks.findOneAndUpdate({_id:'image-generation',$or:[{expiresAt:{$lte:now}},{expiresAt:{$exists:false}}]},{$set:{owner,expiresAt:new Date(now.getTime()+300000)}},{upsert:true,returnDocument:'after'});
    if(!lock)throw fail('A preview is already generating. Please wait for it to finish.',429);
   }catch(e){if(e.code===11000)throw fail('A preview is already generating. Please wait for it to finish.',429);throw e;}
   try{
    await jobs.updateOne({id},{$set:{id,roomId:room.id,design,status:'processing',createdAt:new Date(),error:null}},{upsert:true});
    const form=new FormData();form.set('model',model);form.set('quality','medium');form.set('size','1536x1024');form.set('output_format','jpeg');form.set('output_compression','85');form.set('input_fidelity','high');form.set('prompt',buildPrompt(design,tiles));
    const references=[room.image,...enabledSurfaces.map(s=>{const t=tiles.find(t=>t.id===design[s].tile);return design[s].face==='mixed'?t.image:(t.variants||[t.image])[Number(design[s].face)];})];
    for(const [i,url] of references.entries()){const bytes=await asset(url);form.append('image[]',new Blob([bytes],{type:url.endsWith('.jpg')?'image/jpeg':'image/webp'}),`reference-${i}.${url.endsWith('.jpg')?'jpg':'webp'}`);}
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(240000)});
    if(!response.ok){const messages={401:'The server API key was rejected. Check the key configuration.',403:'This API project does not have access to image editing.',429:'API quota or rate limit reached. Check API billing and limits.'};throw fail(messages[response.status]||'The image provider could not generate this preview. Please try again.');}
    const data=await response.json();if(!data.data?.[0]?.b64_json)throw fail('No image was returned. Please try again.');
    const bytes=Buffer.from(data.data[0].b64_json,'base64');
    if(bytes.length>4*1024*1024)throw fail('The generated preview is too large. Please try again.',502);
    await images.updateOne({_id:id},{$set:{bytes,contentType:'image/jpeg',createdAt:new Date()}},{upsert:true});
    await jobs.updateOne({id},{$set:{status:'complete',imageUrl:`/api/generations/${id}/image`,completedAt:new Date()}});
    return res.json({id,status:'complete',imageUrl:`/api/generations/${id}/image`});
   }catch(e){await jobs.updateOne({id},{$set:{status:'failed',error:e.status?e.message:'Generation was interrupted or timed out. Please try again.'}}).catch(()=>{});throw e;}finally{await locks.deleteOne({_id:'image-generation',owner}).catch(()=>{});}
  }catch(e){res.status(e.status||503).json({error:e.status?e.message:'Preview could not be started. Please try again.'});}
 });
}
