export function tileGeometry(tile,surface,settings,canvasWidth=1200){
 const vertical=settings.rotation%180!==0;
 const width=vertical?tile.heightCm:tile.widthCm,height=vertical?tile.widthCm:tile.heightCm;
 const pixelsPerMeter=canvasWidth/surface.meters[0];
 return {width:width/100*pixelsPerMeter*settings.scale,height:height/100*pixelsPerMeter*settings.scale,vertical};
}
export function faceIndex(row,column,count,face='mixed'){
 if(face!=='mixed')return Math.max(0,Math.min(count-1,Number(face)||0));
 // Stable variation across redraws and downloads.
 const value=Math.imul(row+1,73856093)^Math.imul(column+1,19349663);
 return (value>>>0)%count;
}
