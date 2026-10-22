import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
async function asset(url){const p=path.resolve(assets,'.'+url);if(!p.startsWith(assets+path.sep))throw fail('Invalid asset.');return readFile(p);}
export function mountGenerations(app,db){
 const jobs=db.collection('generations');let active=false;
 const ready=jobs.updateMany({status:'processing'},{$set:{status:'failed',error:'The server restarted during generation. Please generate again.'}});
 // Requests await this task below; handle rejection even if shutdown happens first.
 void ready.catch(()=>{});
 app.get('/api/ai/status',(_req,res)=>res.json({configured:Boolean(process.env.OPENAI_API_KEY?.trim())}));
 app.get('/api/generations/:id',async(req,res)=>{if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.status(404).json({error:'Preview not found.'});const job=await jobs.findOne({id:req.params.id},{projection:{_id:0}});if(!job)return res.status(404).json({error:'Preview not found.'});res.json(job)});
 app.get('/api/generations/:id/image',async(req,res)=>{if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.sendStatus(404);res.sendFile(path.join(output,req.params.id+'.png'),{dotfiles:'allow'},error=>{if(error&&!res.headersSent)res.status(error.code==='ENOENT'?404:500).json({error:'The saved preview could not be loaded.'});});});
 app.post('/api/generations',async(req,res)=>{
  try{
   await ready;
   if(!process.env.OPENAI_API_KEY?.trim())throw fail('AI preview is not configured on the server.',503);
   if(typeof req.body?.roomId!=='string'||req.body.roomId.length>80)throw fail('Choose a valid photo room.');
   const room=await db.collection('rooms').findOne({id:req.body?.roomId,kind:'photo'});if(!room)throw fail('Choose a photo room.');
   const tiles=await db.collection('tiles').find({}).toArray(),design=validateDesign(req.body.design,tiles);
   const model=process.env.OPENAI_IMAGE_MODEL||'gpt-image-1.5';
   const id=createHash('sha256').update(JSON.stringify({version:2,room:room.id,image:room.image,model,design})).digest('hex');
   const previous=await jobs.findOne({id});
   if(previous?.status==='complete')return res.json({id,status:'complete',imageUrl:`/api/generations/${id}/image`,cached:true});
   if(active)throw fail('A preview is already generating. Please wait for it to finish.',429);
   active=true;
   try{await jobs.updateOne({id},{$set:{id,roomId:room.id,design,status:'processing',createdAt:new Date(),error:null}},{upsert:true});}catch(e){active=false;throw e;}
   res.status(202).json({id,status:'processing'});
   void (async()=>{try{
    const form=new FormData();form.set('model',model);form.set('quality','medium');form.set('size','1536x1024');form.set('output_format','png');form.set('input_fidelity','high');form.set('prompt',buildPrompt(design,tiles));
    const references=[room.image,...enabledSurfaces.map(s=>{const t=tiles.find(t=>t.id===design[s].tile);return design[s].face==='mixed'?t.image:(t.variants||[t.image])[Number(design[s].face)];})];
    for(const [i,url] of references.entries()){const bytes=await asset(url);form.append('image[]',new Blob([bytes],{type:url.endsWith('.jpg')?'image/jpeg':'image/webp'}),`reference-${i}.${url.endsWith('.jpg')?'jpg':'webp'}`);}
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(240000)});
    if(!response.ok){const messages={401:'The server API key was rejected. Check the key configuration.',403:'This API project does not have access to image editing.',429:'API quota or rate limit reached. Check API billing and limits.'};throw fail(messages[response.status]||'The image provider could not generate this preview. Please try again.');}
    const data=await response.json();if(!data.data?.[0]?.b64_json)throw fail('No image was returned. Please try again.');
    await mkdir(output,{recursive:true});await writeFile(path.join(output,id+'.png'),Buffer.from(data.data[0].b64_json,'base64'));
    await jobs.updateOne({id},{$set:{status:'complete',imageUrl:`/api/generations/${id}/image`,completedAt:new Date()}});
   }catch(e){await jobs.updateOne({id},{$set:{status:'failed',error:e.status?e.message:e.cause?.code==='EACCES'?'The server cannot access the image provider. Start the backend from a terminal with internet access.':'Generation was interrupted or timed out. Please try again.'}}).catch(()=>{});}finally{active=false;}})();
  }catch(e){res.status(e.status||503).json({error:e.status?e.message:'Preview could not be started. Please try again.'});}
 });
}
