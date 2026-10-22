// Project a unit square to four corners in TL, TR, BR, BL order.
export function homography(q){
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
 const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
 const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const det=dx1*dy2-dx2*dy1;
 if(Math.abs(det)<1e-9)throw new Error('Surface corners must form a non-degenerate quadrilateral.');
 const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
 return (u,v)=>{const w=g*u+h*v+1;return [(x1-x0+g*x1)*u/w+(x3-x0+h*x3)*v/w+x0/w,(y1-y0+g*y1)*u/w+(y3-y0+h*y3)*v/w+y0/w]};
}
function triangle(ctx,img,s,d){
 const [[x0,y0],[x1,y1],[x2,y2]]=s,[[u0,v0],[u1,v1],[u2,v2]]=d;
 const det=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);
 const coeff=(z0,z1,z2)=>[(z0*(y1-y2)+z1*(y2-y0)+z2*(y0-y1))/det,(z0*(x2-x1)+z1*(x0-x2)+z2*(x1-x0))/det,(z0*(x1*y2-x2*y1)+z1*(x2*y0-x0*y2)+z2*(x0*y1-x1*y0))/det];
 const [a,c,e]=coeff(u0,u1,u2),[b,dd,f]=coeff(v0,v1,v2);
 // Slightly overlap triangle clips to prevent anti-alias hairlines in the mesh.
 const cx=(u0+u1+u2)/3,cy=(v0+v1+v2)/3;
 const expanded=d.map(([x,y])=>{const len=Math.hypot(x-cx,y-cy);return [x+(x-cx)/len*.8,y+(y-cy)/len*.8]});
 ctx.save();ctx.beginPath();expanded.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.transform(a,b,c,dd,e,f);ctx.drawImage(img,0,0);ctx.restore();
}
export function warp(ctx,texture,quad){
 const p=homography(quad),n=24,w=texture.width,h=texture.height;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const uv=[[x/n,y/n],[(x+1)/n,y/n],[(x+1)/n,(y+1)/n],[x/n,(y+1)/n]];
  const s=uv.map(([u,v])=>[u*w,v*h]),d=uv.map(([u,v])=>p(u,v));
  triangle(ctx,texture,[s[0],s[1],s[2]],[d[0],d[1],d[2]]);triangle(ctx,texture,[s[0],s[2],s[3]],[d[0],d[2],d[3]]);
 }
}
