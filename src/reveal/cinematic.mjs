// PHOTOMETRY_409: exposure and paper contrast corrected against recorded real-browser frames.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// This module receives an already sampled outcome. It never draws random numbers.
const DURATIONS = { cards: 17000, coin: 15500 };
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x=clamp(x); return x*x*(3-2*x); };
const between = (t,a,b) => smooth((t-a)/(b-a));
const mix = T.MathUtils.lerp;
let prepared, template, soundEnabled=false, audio;
const textures=new Map();
const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};

export function setRevealSound(enabled) {
  soundEnabled=Boolean(enabled);
  if(soundEnabled) { try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume().catch(()=>{}); } catch { soundEnabled=false; } }
  return soundEnabled;
}
function sound(kind, gain=.035) {
  if(!soundEnabled || !audio || audio.state!=='running')return;
  const now=audio.currentTime, out=audio.createGain();out.connect(audio.destination);
  out.gain.setValueAtTime(gain,now);out.gain.exponentialRampToValueAtTime(.0001,now+.28);
  const osc=audio.createOscillator();osc.type=kind==='paper'?'triangle':'sine';
  osc.frequency.setValueAtTime(kind==='paper'?180:kind==='land'?1100:1650,now);
  osc.frequency.exponentialRampToValueAtTime(kind==='paper'?70:kind==='land'?610:950,now+.14);
  osc.connect(out);osc.start(now);osc.stop(now+.29);osc.onended=()=>{osc.disconnect();out.disconnect();};
}

function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function clover(ctx,x,y,r,color){ctx.fillStyle=color;for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.arc(x+a*r*.38,y+b*r*.38,r*.52,0,Math.PI*2);ctx.fill();}}
function cardTexture(which,identity='left') {
  const key=which+identity;if(textures.has(key))return textures.get(key);
  const c=document.createElement('canvas');c.width=768;c.height=1152;const g=c.getContext('2d');
  const back=which==='back', yes=which==='yes';
  g.fillStyle='#fcf7ef';g.fillRect(0,0,768,1152);
  const grad=g.createLinearGradient(0,0,768,1152);grad.addColorStop(0,back?'#cbaadc':yes?'#fff0e6':'#ecf9f3');grad.addColorStop(.53,back?'#f6ccdf':'#fffdf4');grad.addColorStop(1,back?'#b4a4db':yes?'#f4d6e4':'#d5edf3');
  rounded(g,24,24,720,1104,45);g.fillStyle=grad;g.fill();
  for(const inset of [39,54,75]){rounded(g,inset,inset,768-inset*2,1152-inset*2,32);g.strokeStyle=inset===54?'#fefcf2':'#b99050';g.lineWidth=inset===54?5:2;g.stroke();}
  g.textAlign='center';g.fillStyle='#644964';g.font='600 23px Georgia,serif';g.fillText('A LITTLE CHANCE',384,154);
  if(back){
    g.font='italic bold 105px Georgia,serif';g.fillStyle='#56416f';g.fillText('lucky',384,284);
    g.save();g.translate(384,600);
    for(let i=0;i<36;i++){g.rotate(Math.PI/18);g.beginPath();g.moveTo(0,130);g.lineTo(0,205+(i%2)*21);g.strokeStyle='#b4945c';g.lineWidth=2;g.stroke();}
    g.beginPath();g.arc(0,0,178,0,Math.PI*2);g.strokeStyle='#c6a36a';g.lineWidth=4;g.stroke();
    clover(g,0,0,110,'#b78b48');clover(g,-3,-4,100,'#faeed0');g.restore();
    for(const x of [129,639])for(const y of [358,866])clover(g,x,y,18,'#a38abc');
    g.fillStyle='#826985';g.font='600 23px Georgia,serif';g.fillText('GOOD CHOICE, GOOD DAY',384,936);
    g.font='bold 29px Georgia,serif';g.fillText(identity==='left'?'LEFT':'RIGHT',384,1024);
    g.fillStyle='#b78b48';g.beginPath();g.arc(384,1064,5,0,Math.PI*2);g.fill();
  } else {
    g.fillStyle=yes?'#bb5475':'#418984';
    g.font='bold 54px Georgia,serif';g.textAlign='left';g.fillText('A',101,244);g.font='49px Georgia,serif';g.fillText(yes?'♥':'♠',99,301);
    // RESULT_ART_409: original large vector suit, not a tiny font glyph.
    g.save();g.translate(384,498);if(!yes)g.rotate(Math.PI);
    g.beginPath();g.moveTo(0,126);g.bezierCurveTo(-30,87,-151,1,-151,-55);g.bezierCurveTo(-151,-148,-35,-165,0,-85);g.bezierCurveTo(35,-165,151,-148,151,-55);g.bezierCurveTo(151,1,30,87,0,126);g.closePath();
    const ink=g.createLinearGradient(-90,-140,100,130);ink.addColorStop(0,yes?'#d94c84':'#256d73');ink.addColorStop(1,yes?'#9f254f':'#123f54');g.fillStyle=ink;g.fill();g.restore();
    if(!yes){g.fillStyle='#123f54';g.beginPath();g.moveTo(370,549);g.quadraticCurveTo(374,583,343,617);g.lineTo(425,617);g.quadraticCurveTo(394,583,398,549);g.closePath();g.fill();}
    g.textAlign='center';
    g.font='900 80px "Noto Sans CJK JP",sans-serif';g.fillStyle='#181c37';g.fillText(yes?'やってみる':'今回はやらない',384,744);
    g.font='500 30px "Noto Sans CJK JP",sans-serif';g.fillStyle='#4b4d65';g.fillText(yes?'小さな一歩を、今日。':'今日は余白を、ひとつ。',384,823);
    g.font='italic bold 56px Georgia,serif';g.fillStyle='#8e7189';g.fillText('lucky',384,1010);
    g.save();g.translate(666,969);g.rotate(Math.PI);g.textAlign='left';g.fillStyle=yes?'#bb5475':'#418984';g.font='bold 54px Georgia,serif';g.fillText('A',0,0);g.restore();
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;textures.set(key,tex);return tex;
}

export function prepareReveal(method = 'coin') {
  for(const i of ['left','right'])cardTexture('back',i);cardTexture('yes');cardTexture('no');
  if(method === 'cards') return Promise.resolve();
  if(prepared)return prepared;
  prepared=(async()=>{
    const gltf=await new GLTFLoader().loadAsync(new URL('./lucky-coin.glb',import.meta.url).href);
    gltf.scene.updateMatrixWorld(true);
    const batches=new Map();
    gltf.scene.traverse(o=>{if(!o.isMesh)return;let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();for(const k of Object.keys(geo.attributes))if(!['position','normal'].includes(k))geo.deleteAttribute(k);geo.applyMatrix4(o.matrixWorld);const m=o.material;const k=m.name;if(!batches.has(k))batches.set(k,{material:m,geometries:[]});batches.get(k).geometries.push(geo);});
    template=new T.Group();for(const {material,geometries} of batches.values()){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;template.add(mesh);geometries.forEach(g=>g.dispose());}
    for(const i of ['left','right'])cardTexture('back',i);cardTexture('yes');cardTexture('no');
  })().catch(e=>{prepared=null;throw e;});
  return prepared;
}

function makeCard(identity) {
  const root=new T.Group(), surfaces=[];root.name='card-'+identity;
  const w=1.52,h=2.30,r=.10,nx=20,ny=34;
  for(const sign of [1,-1]){
    const positions=[],uv=[],idx=[];
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const v=j/ny,u=i/nx,y=(v-.5)*h;
      const dy=Math.max(0,Math.abs(y)-(h/2-r));const maxX=w/2-r+Math.sqrt(Math.max(0,r*r-dy*dy));
      positions.push((u-.5)*maxX*2,y,sign*.016);uv.push(sign>0?u:1-u,v);
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(...(sign>0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();geo.userData.base=new Float32Array(positions);
    const mat=new T.MeshPhysicalMaterial({map:sign>0?cardTexture('back',identity):cardTexture('yes'),roughness:.52,metalness:0,clearcoat:.18,clearcoatRoughness:.35,side:T.FrontSide});
    const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);surfaces.push(mesh);
  }
  const outline=[];for(let corner=0;corner<4;corner++){const cx=(corner===0||corner===3?1:-1)*(w/2-r),cy=(corner<2?1:-1)*(h/2-r);for(let i=0;i<=12;i++){const a=(corner*Math.PI/2)+i/12*Math.PI/2;outline.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}}
  const p=[],idx=[];outline.forEach(([x,y])=>p.push(x,y,.016,x,y,-.016));for(let i=0;i<outline.length;i++){const a=i*2,b=((i+1)%outline.length)*2;idx.push(a,b,a+1,b,b+1,a+1);}
  const eg=new T.BufferGeometry();eg.setAttribute('position',new T.Float32BufferAttribute(p,3));eg.setIndex(idx);eg.computeVertexNormals();eg.userData.base=new Float32Array(p);
  const edge=new T.Mesh(eg,new T.MeshStandardMaterial({color:0xdbcba9,roughness:.66,side:T.DoubleSide}));root.add(edge);surfaces.push(edge);
  return {root,front:surfaces[1],bend(amount){for(const mesh of surfaces){const pos=mesh.geometry.attributes.position,b=mesh.geometry.userData.base;for(let i=0;i<pos.count;i++){const x=b[i*3],y=b[i*3+1],v=clamp((y/h)+.5);const k=Math.pow(v,3)*(.45+.55*(x/w+.5));pos.setXYZ(i,x,y-amount*k*.18,b[i*3+2]+amount*k);}pos.needsUpdate=true;mesh.geometry.computeVertexNormals();}}};
}
function shadowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),v=g.createRadialGradient(64,64,1,64,64,63);v.addColorStop(0,'rgba(90,65,80,.25)');v.addColorStop(.45,'rgba(100,70,90,.1)');v.addColorStop(1,'rgba(100,70,90,0)');g.fillStyle=v;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
function normalOfCoin(root,side){const v=new T.Vector3(0,side==='heads'?1:-1,0);return v.applyQuaternion(root.quaternion).toArray();}

export function startCinematicMotion(stage,label,method,outcome,{reduced=false,onComplete=()=>{},onError=()=>{}}={}) {
  const total=DURATIONS[method];if(!total)throw new Error('Unsupported cinematic scene');
  if(method==='coin'&&!template)throw new Error('コイン素材を読み込み中です。もう一度押してください。');
  const visual=node('div','quick-animation-visual cinematic-visual'), badge=node('div','cinematic-badge',method==='cards'?(outcome.picked==='left'?'左のカードを選びました':'右のカードを選びました'):(outcome.picked==='heads'?'表でいく':'裏でいく'));
  const canvas=document.createElement('canvas');canvas.className='cinematic-canvas';canvas.setAttribute('aria-hidden','true');
  visual.append(canvas,badge);stage.replaceChildren(visual);stage.hidden=false;
  stage.dataset.method=method;stage.dataset.durationMs=String(total);stage.dataset.phase='prepare';stage.dataset.renderer='webgl';stage.dataset.hero=method;
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});}
  catch(e){stage.dataset.renderer='unavailable';throw new Error('このブラウザで3D画面を開始できませんでした。別の決め方をお試しください。');}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,40);
  camera.position.set(0,4.7,5.6);camera.lookAt(0,.1,0);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xfffbf1,0xf1dbe7,.85));
  const key=new T.DirectionalLight(0xfff5e5,1.7);key.position.set(-3.5,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.025;key.shadow.bias=-.0001;scene.add(key);
  const fill=new T.DirectionalLight(0xffdbea,.55);fill.position.set(4,3,-2);scene.add(fill);
  const floor=new T.Mesh(new T.CircleGeometry(5,96),new T.MeshStandardMaterial({color:0xfff5f0,roughness:.93,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
  const contactMap=shadowTexture(),contact=new T.Mesh(new T.PlaneGeometry(2.6,2.6),new T.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,opacity:.75}));contact.rotation.x=-Math.PI/2;contact.position.y=-.02;scene.add(contact);
  const halo=new T.Mesh(new T.RingGeometry(2.12,2.13,96),new T.MeshBasicMaterial({color:0xd7b99c,transparent:true,opacity:.25,side:T.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=-.014;scene.add(halo);
  let cards,coin;
  if(method==='cards') {cards=[makeCard('left'),makeCard('right')];cards.forEach(c=>scene.add(c.root));cards[outcome.chosenCard].front.material.map=cardTexture(outcome.result);}
  else {coin=template.clone(true);scene.add(coin);}
  let alive=true,raf=0,start=performance.now(),pausedAt=null,completed=false,lastCue='',lastSound=-1;
  const target=new T.Vector3();
  function resize(){const r=visual.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();if(completed)renderer.render(scene,camera);}
  const observer=new ResizeObserver(resize);observer.observe(visual);resize();
  function cue(phase,text){stage.dataset.phase=phase;if(lastCue!==text){lastCue=text;label.textContent=text;}}
  function cardsFrame(t){
    const chosen=cards[outcome.chosenCard],other=cards[1-outcome.chosenCard];
    const take=between(t,4.3,7.3),close=between(t,6.8,10.5),turn=between(t,13.2,15.12);
    cards.forEach((card,i)=>{const side=i===0?-1:1;
      let x=side*.92,y=.055,z=0,rz=side*-.12;
      if(t<4.3&&t>.85){const u=(t-.85)/3.45;const swing=Math.sin(u*Math.PI*3);x=side*.92*(1-(reduced?.2:1.62)*Math.sin(u*Math.PI*3)**2);z=side*(reduced?.07:.43)*swing;y=.10+(i===0?Math.max(0,swing):Math.max(0,-swing))*(reduced?.05:.35);rz+=swing*(reduced?.04:.18);}
      card.root.position.set(x,y,z);card.root.rotation.set(-Math.PI/2,0,rz);card.root.scale.setScalar(1);
    });
    const sign=outcome.chosenCard===0?-1:1;
    chosen.root.position.set(mix(chosen.root.position.x,0,take),mix(chosen.root.position.y,1.15,take),mix(chosen.root.position.z,.18,take));
    chosen.root.rotation.set(mix(-Math.PI/2,-.035,take),Math.PI*turn,mix(sign*-.12,0,take));
    other.root.position.x=mix(other.root.position.x,-sign*2.8,take);other.root.position.z=mix(other.root.position.z,-1.3,take);other.root.rotation.z+=take*.28;other.root.visible=t<8.3;
    const bend=(between(t,8.3,11.7)*.29+between(t,11.7,12.5)*.055)*(1-between(t,13.35,14.8));chosen.bend(reduced?bend*.2:bend);
    const camClose=reduced?close*.75:close;camera.position.set(mix(0,.12,camClose),mix(4.7,1.6,camClose),mix(5.6,4.8,camClose));target.set(0,mix(.1,1.12,camClose),.08);camera.lookAt(target);
    contact.position.x=chosen.root.position.x;contact.scale.set(1.2,1.25,1);contact.material.opacity=mix(.72,.25,take);
    key.position.x=mix(-3.5,2.4,between(t,8,12.2));
    if(t<.85)cue('prepare','選んだのは、この1枚。');else if(t<4.3)cue('shuffle','');else if(t<8.3)cue('focus','あなたの1枚を、手もとへ。');else if(t<13.2)cue('suspense','');else if(t<15.12)cue('reveal','オープン。');else cue('settled','');
    if(t>=15.12){badge.textContent=outcome.result==='yes'?'今日に、小さな一歩。':'今日は、余白をひとつ。';badge.classList.add('is-settled');}
    const beat=t<4.3?Math.floor(t*2.2):-1;if(beat>=0&&beat!==lastSound){lastSound=beat;sound('paper',.014);}
    stage.dataset.visibleResult=t>=15.12?outcome.result:'';stage.dataset.selectedCard=String(outcome.chosenCard);stage.dataset.pose=JSON.stringify({rotationY:chosen.root.rotation.y,bend,heroHeight:2.3,focus:close});
  }
  function coinFrame(t){
    let tilt,spin;const rise=between(t,.1,2.4),fall=between(t,8.1,13.0);
    tilt=mix(0,Math.PI/2-.09,rise);
    // An art-directed contact roll, not a claim of a rigid-body simulation.
    const turnSpeed=reduced?.34:1;
    spin=t<2.4?between(t,.4,2.4)*1.4:(1.4+(t-2.4)*4.65-(Math.max(0,t-6.2)**2)*.21)*turnSpeed;
    if(t>=8.1){const end=outcome.landed==='heads'?0:Math.PI;tilt=mix(Math.PI/2-.09,end,fall);tilt+=Math.sin(t*12)*.035*(1-fall);}
    const finalYaw=Math.PI*(outcome.landed==='heads'?4:5);
    const settle=between(t,11.8,13.2);spin=mix(spin,finalYaw,settle);
    coin.rotation.order='YXZ';coin.rotation.set(0,spin,tilt);
    coin.position.set(Math.sin(t*.6)*.16*(1-settle),.059*Math.abs(Math.cos(tilt))+.76*Math.abs(Math.sin(tilt))+.005,0);
    if(t>=13.2){coin.rotation.set(0,finalYaw,outcome.landed==='heads'?0:Math.PI);coin.position.set(0,.064,0);}
    const close=between(t,7.2,12.3);camera.position.set(mix(.2,0,close),mix(2.65,3.55,close),mix(4.7,2.32,close));target.set(0,mix(.30,.025,close),0);camera.lookAt(target);
    contact.position.x=coin.position.x;contact.scale.set(mix(.55,1.0,fall),mix(.75,1.0,fall),1);contact.material.opacity=.65;
    if(t<2.4)cue('prepare','いくよ。');else if(t<8.1)cue('spin','');else if(t<13.2)cue('suspense','どちらへ、倒れる？');else cue('settled','');
    if(t>=13.2){badge.textContent=outcome.landed==='heads'?'表 — HEADS':'裏 — TAILS';badge.classList.add('is-settled');}
    const beat=Math.floor(t*(t>8.1?6:2));if(t>2.4&&t<13.1&&beat!==lastSound){lastSound=beat;sound('tick',mix(.008,.023,fall));}
    stage.dataset.visibleResult=t>=13.2?outcome.result:'';stage.dataset.landed=t>=13.2?outcome.landed:'';stage.dataset.pose=JSON.stringify({normal:normalOfCoin(coin,outcome.landed),contactY:coin.position.y,tilt,focus:close});
  }
  let lastSettled=false;
  function frame(now){if(!alive||pausedAt!==null)return;try {const elapsed=Math.min(total,now-start),t=elapsed/1000;
    stage.dataset.elapsedMs=String(Math.round(elapsed));method==='cards'?cardsFrame(t):coinFrame(t);renderer.render(scene,camera);
    if(stage.dataset.visibleResult&&!lastSettled){lastSettled=true;sound('land',.033);}
    if(elapsed>=total){completed=true;stage.dataset.phase='done';onComplete();return;}
    raf=requestAnimationFrame(frame);
    } catch (e) { cancelAnimationFrame(raf); onError(e); }
  }
  function visibility(){if(document.hidden){pausedAt=performance.now();cancelAnimationFrame(raf);}else if(pausedAt!==null){start+=performance.now()-pausedAt;pausedAt=null;raf=requestAnimationFrame(frame);}}
  document.addEventListener('visibilitychange',visibility);
  function contextLost(e){e.preventDefault();cancelAnimationFrame(raf);onError(new Error('WebGL context lost'));}
  canvas.addEventListener('webglcontextlost',contextLost);raf=requestAnimationFrame(frame);
  return {duration:total,cancel(){if(!alive)return;alive=false;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',contextLost);scene.traverse(o=>{if(o.isMesh&&o!==coin&&!coin?.children.includes(o)){o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();}});env.dispose();contactMap.dispose();renderer.dispose();renderer.forceContextLoss();},get phase(){return stage.dataset.phase;}};
}
