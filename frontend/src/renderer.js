import {warp} from './perspective.js';
import {tileGeometry,faceIndex} from './tile-layout.js';
const cache=new Map();
export function loadImage(src){if(!cache.has(src))cache.set(src,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(src);reject(new Error('Could not load image: '+src))};im.src=src}));return cache.get(src)}
function texture(tile,images,surface,settings){
 const c=document.createElement('canvas');c.width=1200;c.height=Math.round(1200*surface.meters[1]/surface.meters[0]);const ctx=c.getContext('2d');
 ctx.fillStyle=settings.grout;ctx.fillRect(0,0,c.width,c.height);
 const {width:tw,height:th,vertical}=tileGeometry(tile,surface,settings,c.width),gap=Math.max(1,Math.min(tw,th)*.018);
 const cells=images.map(img=>{const cell=document.createElement('canvas');cell.width=Math.ceil(tw);cell.height=Math.ceil(th);const cc=cell.getContext('2d');cc.translate(cell.width/2,cell.height/2);cc.rotate(settings.rotation*Math.PI/180);cc.drawImage(img,-(vertical?th:tw)/2,-(vertical?tw:th)/2,vertical?th:tw,vertical?tw:th);return cell});
 for(let row=0,y=0;y<c.height;y+=th,row++)for(let column=0,x=settings.layout==='brick'&&row%2?-tw/2:0;x<c.width;x+=tw,column++)ctx.drawImage(cells[faceIndex(row,column,cells.length,settings.face)],x+gap/2,y+gap/2,tw-gap,th-gap);
 return c;
}
export async function renderRoom(canvas,room,tiles,design,original=false){
 if(room.kind==='photo') return renderPhotoRoom(canvas,room,tiles,design,original);
 const [base,front,...images]=await Promise.all([loadImage(room.image),loadImage(room.foreground),...(!original?['floor','wall'].map(s=>{const tile=tiles.find(t=>t.id===design[s].tile);return Promise.all((tile.variants||[tile.image]).map(loadImage))}):[])]);
 const out=document.createElement('canvas');out.width=room.width;out.height=room.height;const ctx=out.getContext('2d');ctx.drawImage(base,0,0,out.width,out.height);
 if(!original)['floor','wall'].forEach((s,i)=>{const tile=tiles.find(t=>t.id===design[s].tile);warp(ctx,texture(tile,images[i],room.surfaces[s],design[s]),room.surfaces[s].quad);const q=room.surfaces[s].quad;ctx.save();ctx.beginPath();q.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();const shade=ctx.createLinearGradient(s==='floor'?0:260,s==='floor'?410:60,s==='floor'?0:840,s==='floor'?760:410);shade.addColorStop(0,s==='floor'?'rgba(28,30,26,.23)':'rgba(255,252,236,.08)');shade.addColorStop(.45,'rgba(255,251,234,.03)');shade.addColorStop(1,'rgba(28,30,26,.09)');ctx.fillStyle=shade;ctx.fillRect(0,0,out.width,out.height);ctx.restore()});
 // Ambient occlusion anchors the mapped finishes at the room corners.
 for(const surface of ['wall','floor']) {
  const q=room.surfaces[surface].quad;ctx.save();ctx.beginPath();q.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  const edge=ctx.createLinearGradient(260,0,840,0);edge.addColorStop(0,'rgba(28,25,20,.15)');edge.addColorStop(.08,'rgba(28,25,20,0)');edge.addColorStop(.9,'rgba(28,25,20,0)');edge.addColorStop(1,'rgba(28,25,20,.18)');ctx.fillStyle=edge;ctx.fillRect(0,0,out.width,out.height);
  if(surface==='floor'){const light=ctx.createRadialGradient(180,460,15,180,460,650);light.addColorStop(0,'rgba(255,247,215,.16)');light.addColorStop(1,'rgba(255,247,215,0)');ctx.fillStyle=light;ctx.fillRect(0,410,1100,350);}
  ctx.restore();
 }
 ctx.drawImage(front,0,0,out.width,out.height);canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);
}

// Surface masks are calibrated in normalized photo coordinates. Exclusions keep
// furniture, rugs and architectural features from being painted over.
function photoPath(ctx,points,width,height){
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*width/1000,y*height/1000):ctx.moveTo(x*width/1000,y*height/1000));ctx.closePath();
}
async function renderPhotoRoom(canvas,room,tiles,design,original){
 const base=await loadImage(room.image);
 const out=document.createElement('canvas');out.width=room.width;out.height=room.height;
 const ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(base,0,0,out.width,out.height);
 if(!original){
  const source=ctx.getImageData(0,0,out.width,out.height).data;
  const lighting=document.createElement('canvas');lighting.width=out.width;lighting.height=out.height;
  const lightContext=lighting.getContext('2d',{willReadFrequently:true});lightContext.filter='blur(10px)';lightContext.drawImage(out,0,0);
  const illumination=lightContext.getImageData(0,0,out.width,out.height).data;
  for(const name of ['floor','wall']){
   const surface=room.surfaces[name];if(!surface)continue;
   const settings=design[name];if(!settings)continue;const tile=tiles.find(t=>t.id===settings.tile);
   const images=await Promise.all((tile.variants||[tile.image]).map(loadImage));
   const layer=document.createElement('canvas');layer.width=out.width;layer.height=out.height;
   const lc=layer.getContext('2d',{willReadFrequently:true});
   lc.save();photoPath(lc,surface.polygon,out.width,out.height);lc.clip();
   warp(lc,texture(tile,images,surface,settings),surface.quad);lc.restore();
   lc.globalCompositeOperation='destination-out';
   for(const [index,polygon] of (surface.exclude||[]).entries()){
    if(room.id==='photo-green'&&name==='wall'&&(index===1||index===2))continue;
    photoPath(lc,polygon,out.width,out.height);lc.fill();
   }
   for(const line of surface.excludeLines||[]){
    lc.beginPath();line.points.forEach(([x,y],index)=>index?lc.lineTo(x*out.width/1000,y*out.height/1000):lc.moveTo(x*out.width/1000,y*out.height/1000));
    lc.lineWidth=line.width*out.width/1000;lc.lineJoin='round';lc.lineCap='round';lc.stroke();
   }
   lc.globalCompositeOperation='source-over';
   const mapped=lc.getImageData(0,0,out.width,out.height);
   for(let i=0;i<mapped.data.length;i+=4){
    if(!mapped.data[i+3])continue;
    const pixel=i/4,nx=(pixel%out.width)/out.width*1000,ny=Math.floor(pixel/out.width)/out.height*1000;
    if(room.id==='photo-green'&&name==='wall'&&((nx<205&&ny>280)||(nx>478&&nx<588&&ny>590))){
     const r=source[i],g=source[i+1],b=source[i+2];
     // Teal plaster is separable from the green foliage in this predefined photo.
     if(!(r<g*.72&&b>g*.67)){mapped.data[i+3]=0;continue;}
    }
    const luminance=(illumination[i]*.2126+illumination[i+1]*.7152+illumination[i+2]*.0722)/255;
    const light=Math.max(.42,Math.min(1.12,.48+luminance*(surface.light||.85)));
    for(let channel=0;channel<3;channel++)mapped.data[i+channel]*=light;
   }
   lc.putImageData(mapped,0,0);ctx.drawImage(layer,0,0);
  }
 }
 canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);
}
