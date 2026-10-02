/** User-approved geometric corrections. Original artwork is never modified. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {PNG} = require('pngjs');
const source = 'public/assets/huddle-field-assets';
const output = 'public/assets/huddle-field-aligned';
const geometry = JSON.parse(fs.readFileSync(`${source}/geometry.json`,'utf8'));
// Measured white end-zone boundary intersections in the exact supplied base PNG.
const corrected = {base_width:1614,base_height:304,
 left_endzone_polygon:[[218,35],[315,35],[153,273],[15,273]],
 right_endzone_polygon:[[1269,35],[1369,35],[1569,273],[1428,273]],
 rule:'Corrected overlay copies; base and original asset pack unchanged. Full-canvas stack, no renderer transforms.'};
function homography(from,to){
 const m=[];
 for(let i=0;i<4;i++){
  const [x,y]=from[i],[u,v]=to[i];
  m.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);
 }
 for(let c=0;c<8;c++){
  let pivot=c;for(let r=c+1;r<8;r++)if(Math.abs(m[r][c])>Math.abs(m[pivot][c]))pivot=r;
  [m[c],m[pivot]]=[m[pivot],m[c]];
  const divisor=m[c][c];if(Math.abs(divisor)<1e-10)throw Error('Singular geometry');
  for(let j=c;j<9;j++)m[c][j]/=divisor;
  for(let r=0;r<8;r++)if(r!==c){const factor=m[r][c];for(let j=c;j<9;j++)m[r][j]-=factor*m[c][j];}
 }
 return m.map(row=>row[8]);
}
function warp(image,from,to){
 const h=homography(to,from), result=new PNG({width:image.width,height:image.height});
 result.data.fill(0);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const denom=h[6]*x+h[7]*y+1, sx=(h[0]*x+h[1]*y+h[2])/denom, sy=(h[3]*x+h[4]*y+h[5])/denom;
  if(sx<0||sy<0||sx>=image.width-1||sy>=image.height-1)continue;
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
  const pixels=[[ix,iy,(1-fx)*(1-fy)],[ix+1,iy,fx*(1-fy)],[ix,iy+1,(1-fx)*fy],[ix+1,iy+1,fx*fy]];
  let alpha=0;const channels=[0,0,0];
  for(const [px,py,weight] of pixels){const offset=(py*image.width+px)*4,a=image.data[offset+3]/255;alpha+=weight*a;for(let c=0;c<3;c++)channels[c]+=image.data[offset+c]*weight*a;}
  const offset=(y*image.width+x)*4;
  if(alpha>0){for(let c=0;c<3;c++)result.data[offset+c]=Math.round(channels[c]/alpha);result.data[offset+3]=Math.round(alpha*255);}
 }
 return result;
}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const teams=fs.readdirSync(`${source}/endzones`).filter(t=>fs.statSync(`${source}/endzones/${t}`).isDirectory()).sort();
const originals=[`${source}/base_field.png`,`${source}/geometry.json`,...teams.flatMap(t=>['left','right'].map(side=>`${source}/endzones/${t}/${side}.png`))];
const before=Object.fromEntries(originals.map(p=>[p,hash(p)]));
for(const team of teams){
 fs.mkdirSync(`${output}/endzones/${team}`,{recursive:true});
 for(const side of ['left','right']){
  const png=PNG.sync.read(fs.readFileSync(`${source}/endzones/${team}/${side}.png`));
  if(png.width!==1614||png.height!==304)throw Error('Unexpected source size');
  const result=warp(png,geometry[`${side}_endzone_polygon`],corrected[`${side}_endzone_polygon`]);
  fs.writeFileSync(`${output}/endzones/${team}/${side}.png`,PNG.sync.write(result));
 }
}
fs.writeFileSync(`${output}/geometry.json`,JSON.stringify(corrected,null,2)+'\n');
for(const p of originals)if(hash(p)!==before[p])throw Error(`Original changed: ${p}`);
fs.writeFileSync(`${output}/source-hashes.json`,JSON.stringify(before,null,2)+'\n');
console.log('Aligned 64 overlay copies. Verified all original PNGs and source geometry unchanged.');
