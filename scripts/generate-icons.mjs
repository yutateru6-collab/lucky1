/** Dependency-free PNG renderer for the SVG clover geometry; called before test/build. */
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const dir = new URL('../public/icons/', import.meta.url);
await mkdir(dir, { recursive: true });
const colors = { bg: [33, 79, 60], line: [91, 119, 92], leaf: [238, 233, 214], dot: [214, 183, 118] };
function curve(a, b, c, d) {
  return Array.from({ length: 33 }, (_, i) => { const t = i / 32, u = 1 - t; return [0, 1].map(k => u ** 3 * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t ** 3 * d[k]); });
}
const lobe = [...curve([12,12], [2,13], [2,3], [7,3]), ...curve([7,3], [10,3], [12,8], [12,12])];
const leaves = Array.from({ length: 4 }, (_, i) => lobe.map(([x,y]) => { x -= 12; y -= 12; for (let j=0;j<i;j++) [x,y]=[-y,x]; return [256 + x*12, 250 + y*12]; }));
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { for (let k=0;k<8;k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function chunk(type, data) { const name = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); let c = 0xffffffff; for (const b of Buffer.concat([name, data])) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0); return Buffer.concat([len, name, data, crc]); }
function render(size) {
  const scale = 3, n = size*scale, factor=n/512, pixels=new Uint8Array(n*n*3);
  const paint=(x,y,color)=>pixels.set(color,(y*n+x)*3);
  for (let y=0;y<n;y++) for(let x=0;x<n;x++) { const xx=(x+.5)/factor, yy=(y+.5)/factor, r=Math.hypot(xx-256,yy-250); paint(x,y, Math.hypot(xx-256,yy-388)<8 ? colors.dot : Math.abs(r-166)<1 ? colors.line : colors.bg); }
  for (const poly of leaves) for (let y=0;y<n;y++) {
    const yy=(y+.5)/factor, crossings=[];
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) { const [x1,y1]=poly[i], [x2,y2]=poly[j]; if((y1>yy)!==(y2>yy)) crossings.push(x1+(yy-y1)*(x2-x1)/(y2-y1)); }
    crossings.sort((a,b)=>a-b);
    for(let i=0;i+1<crossings.length;i+=2) for(let x=Math.max(0,Math.ceil(crossings[i]*factor-.5));x<n && (x+.5)/factor<crossings[i+1];x++) paint(x,y,colors.leaf);
  }
  const data=Buffer.alloc((size*3+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) for(let c=0;c<3;c++) { let sum=0; for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) sum+=pixels[((y*scale+dy)*n+x*scale+dx)*3+c]; data[y*(size*3+1)+1+x*3+c]=Math.round(sum/(scale*scale)); }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(data,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180],['maskable-512.png',512]]) await writeFile(new URL(name,dir),render(size));
console.log('Generated 192/512/apple/maskable PNG icons from clover geometry.');
