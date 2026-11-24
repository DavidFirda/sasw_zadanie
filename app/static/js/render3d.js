
"use strict";

const V3 = (function(){
  const host=document.getElementById("host3d");
  const glOk=(()=>{ try{ const c=document.createElement("canvas"); return !!(c.getContext("webgl2")||c.getContext("webgl")); }catch(e){ return false; } })();
  if(!window.THREE || !glOk || !host) return {ok:false};
  const T=window.THREE;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas=document.getElementById("c3d"), ovl=document.getElementById("ovl3d"), tip=document.getElementById("tip3d");
  let renderer;
  try{ renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true}); }catch(e){ return {ok:false}; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputEncoding=T.sRGBEncoding; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(32,1,5,6000);
  scene.add(new T.HemisphereLight(0xdde8e3,0x141917,0.5));
  const key=new T.DirectionalLight(0xffffff,1.15); key.position.set(700,900,900); scene.add(key);
  const rim=new T.DirectionalLight(0xbcd6ff,0.9); rim.position.set(-500,600,-900); scene.add(rim);
  const inner=new T.PointLight(0xfff2e0,0.6,700); scene.add(inner);

  /* ---------- textúry a materiály ---------- */
  const lin=c=>new T.Color(c).convertSRGBToLinear();
  const std=(c,r=.6,m=.2,extra={})=>{ if(extra.emissive!==undefined) extra.emissive=lin(extra.emissive); return new T.MeshStandardMaterial(Object.assign({color:lin(c),roughness:r,metalness:m},extra)); };
  function pattern(draw,size=32){ const cv=document.createElement("canvas"); cv.width=cv.height=size; const g=cv.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,size,size); g.fillStyle="#000"; draw(g,size); const t=new T.CanvasTexture(cv); t.wrapS=t.wrapT=T.RepeatWrapping; return t; }
  const TEX={
    dots:pattern((g)=>{ for(let y=4;y<32;y+=8) for(let x=(y%16?0:4)+4;x<32;x+=8){ g.beginPath(); g.arc(x,y,2.6,0,7); g.fill(); } }),
    fine:pattern((g)=>{ for(let y=2;y<32;y+=4) for(let x=(y%8?0:2)+2;x<32;x+=4){ g.beginPath(); g.arc(x,y,1.25,0,7); g.fill(); } }),
    tri:pattern((g)=>{ for(let r=0;r<4;r++) for(let c=0;c<4;c++){ const x=c*8+(r%2?4:0), y=r*8+1; g.beginPath(); g.moveTo(x,y+6); g.lineTo(x+3.4,y); g.lineTo(x+6.8,y+6); g.closePath(); g.fill(); } }),
    shadow:(()=>{ const cv=document.createElement("canvas"); cv.width=cv.height=128; const g=cv.getContext("2d"); const gr=g.createRadialGradient(64,64,4,64,64,64); gr.addColorStop(0,"rgba(0,0,0,.55)"); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(0,0,128,128); return new T.CanvasTexture(cv); })(),
  };
  const M={
    wood:std(0x8b5a32,.75,.05), woodDark:std(0x5d3b1f,.8,.05),
    pcb:std(0x0f2a22,.75,.1), pcbDark:std(0x15191b,.75,.1),
    hsDark:std(0x2a2e30,.35,.8), hsSilver:std(0xb8bfc1,.3,.9), hsWhite:std(0xe8ecec,.45,.3),
    metal:std(0xa9b1b3,.3,.9), socket:std(0x8f989a,.35,.8), ihs:std(0xc9cfd1,.25,.95), slot:std(0x0f1112,.6,.2),
    fanFrame:std(0x151718,.6,.3), fanFrameW:std(0xe6e9e9,.55,.1), blade:std(0x2d3133,.5,.2), bladeW:std(0xd5dada,.5,.1), hub:std(0x1f2324,.4,.5),
    nocFrame:std(0x6b4a3a,.6,.1), nocBlade:std(0xc9a58a,.6,.1),
    fins:std(0x9aa2a5,.35,.85), finsBlack:std(0x2a2d30,.4,.7), copper:std(0xb87333,.3,1),
    ram:std(0x131516,.45,.6), psu:std(0x18191a,.5,.6), ssd:std(0x121314,.5,.4), sata:std(0x2a2d2f,.4,.6), hdd:std(0x9aa0a3,.35,.8),
    rgb:std(0x222222,.4,.1,{emissive:0x000000,emissiveIntensity:1.6}),
    ddr5:std(0x46a97f,.5,.3,{emissive:0x16402e}), ddr4:std(0xc58a4a,.5,.3,{emissive:0x3a220c}),
    tube:std(0x141516,.7,.1), pump:std(0x1b1d1f,.35,.6), rad:std(0x1c1e20,.45,.7),
    limitOk:new T.MeshBasicMaterial({color:0x46a97f,transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false}),
    limitBad:new T.MeshBasicMaterial({color:0xf06a55,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}),
    shadow:new T.MeshBasicMaterial({map:TEX.shadow,transparent:true,depthWrite:false}),
  };
  const GPU_STYLE={
    fe:{body:std(0x1c1f21,.4,.7), trim:std(0xa3abae,.25,.95), strip:true},
    dual:{body:std(0x2f3438,.45,.5), trim:std(0x8d9598,.3,.8), strip:false},
    ventus:{body:std(0x4b5156,.4,.6), trim:std(0x24282a,.4,.5), strip:false},
    pulse:{body:std(0x18191b,.45,.5), trim:std(0xb3262b,.4,.3), strip:false},
    astral:{body:std(0x17191b,.35,.8), trim:std(0x8f979b,.25,.95), strip:true},
  };
  const PAL={};
  function pal(white){ const k=white?"w":"b"; if(PAL[k]) return PAL[k];
    const base=white?0xe4e7e6:0x1d2122, edge=white?0xcfd4d2:0x2a2f30, tray=white?0xeef1f0:0x191d1c;
    const mk=(tex)=>std(white?0xdadfdd:0x121415,.6,white?.1:.5,{alphaMap:tex,transparent:true,alphaTest:.4,side:T.DoubleSide});
    return PAL[k]={shell:std(base,.6,white?.1:.25), edge:std(edge,.5,white?.15:.6), tray:std(tray,.85,.1), shroud:std(white?0xe7eae9:0x121415,.7,.2,{transparent:true,opacity:.8}),
      dots:mk(TEX.dots), fine:mk(TEX.fine), tri:mk(TEX.tri), fan:white?M.fanFrameW:M.fanFrame, blade:white?M.bladeW:M.blade,
      glass:new T.MeshBasicMaterial({color:white?0xd8eef5:0x9cc0cc,transparent:true,opacity:white?.05:.07,depthWrite:false,side:T.DoubleSide})}; }
  const MESH_MATS=new Set(); [true,false].forEach(w=>{ const p=pal(w); MESH_MATS.add(p.dots); MESH_MATS.add(p.fine); MESH_MATS.add(p.tri); });
  const RGB=[null,0x46ffae,0x4aa3ff,0xb46bff,0xff8a3d,0xffffff];

  /* ---------- stav ---------- */
  const S={root:null, spin:[], pops:[], helpers:[], badges:[], disposables:[], groups:{}, caseId:null,
    az:.72, el:.26, dist:1400, tAz:.72, tEl:.26, tDist:1400, target:new T.Vector3(), auto:!reduce, glass:true, rgb:0,
    hover:null, visible:true, prev:null, limitLabel:null, last:performance.now()};
  const grid=new T.GridHelper(3000,60,0x2c3a34,0x1c2622); grid.material.transparent=true; grid.material.opacity=.55; scene.add(grid);

  /* ---------- pomocníci ---------- */
  function boxAt(x0,y0,z0,x1,y1,z1,mat,parent){ const w=Math.max(.3,Math.abs(x1-x0)),h=Math.max(.3,Math.abs(y1-y0)),d=Math.max(.3,Math.abs(z1-z0));
    const geo=new T.BoxGeometry(w,h,d);
    if(MESH_MATS.has(mat)){ const uv=geo.attributes.uv; const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]]; const sc=mat.alphaMap===TEX.fine?4:7; for(let f=0;f<6;f++) for(let i=0;i<4;i++){ const j=f*4+i; uv.setXY(j,uv.getX(j)*dims[f][0]/sc,uv.getY(j)*dims[f][1]/sc); } uv.needsUpdate=true; }
    const m=new T.Mesh(geo,mat); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); parent.add(m); return m; }
  function cyl(r,len,mat,parent,seg=24){ const m=new T.Mesh(new T.CylinderGeometry(r,r,len,seg),mat); parent.add(m); return m; }
  function noPick(o){ o.raycast=()=>{}; return o; }
  function label(text,wmm,hmm,{fg="#e8eeeb",weight=800,size=64}={}){
    const cv=document.createElement("canvas"); cv.width=512; cv.height=Math.max(16,Math.round(512*hmm/wmm)); const g=cv.getContext("2d");
    g.fillStyle=fg; g.font=`${weight} ${size}px Archivo, Arial, sans-serif`; g.textBaseline="middle"; g.fillText(text,18,cv.height/2);
    const t=new T.CanvasTexture(cv); t.encoding=T.sRGBEncoding; const mat=new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false});
    S.disposables.push(t,mat); return new T.Mesh(new T.PlaneGeometry(wmm,hmm),mat); }
  function fan(size,thick,{rgb=true,frame=M.fanFrame,blade=M.blade}={}){ // os ventilátora = lokálna z
    const g=new T.Group(), r=size/2, fr=4;
    boxAt(-r,-r,-thick/2,-r+fr,r,thick/2,frame,g); boxAt(r-fr,-r,-thick/2,r,r,thick/2,frame,g);
    boxAt(-r,-r,-thick/2,r,-r+fr,thick/2,frame,g); boxAt(-r,r-fr,-thick/2,r,r,thick/2,frame,g);
    const ring=new T.Mesh(new T.CylinderGeometry(r*.94,r*.94,thick,40,1,true),frame); ring.rotation.x=Math.PI/2; g.add(ring);
    if(rgb){ const tor=new T.Mesh(new T.TorusGeometry(r*.9,1.4,6,48),M.rgb); tor.position.z=thick/2-1; g.add(tor); }
    const rotor=new T.Group(); const hub=cyl(r*.3,thick*.8,M.hub,rotor); hub.rotation.x=Math.PI/2;
    for(let i=0;i<7;i++){ const b=new T.Mesh(new T.BoxGeometry(r*.62,r*.34,1.4),blade); const a=i/7*Math.PI*2; b.position.set(Math.cos(a)*r*.58,Math.sin(a)*r*.58,0); b.rotation.z=a; b.rotation.x=.45; rotor.add(b); }
    g.add(rotor); S.spin.push(rotor); return g; }
  function fanAt(parent,size,thick,axis,x,y,z,opts){ const f=fan(size,thick,opts); if(opts&&opts.caseFan) f.traverse(o=>o.userData.caseFan=true); if(axis==="x") f.rotation.y=Math.PI/2; if(axis==="y") f.rotation.x=Math.PI/2; f.position.set(x,y,z); parent.add(f); return f; }
  function part(cat,name){ const g=new T.Group(); g.userData={cat,name}; S.root.add(g); (S.groups[cat]=S.groups[cat]||[]).push(g); return g; }

  /* ---------- skrinky podľa reálnych modelov ---------- */
  function buildCase(id,L,D,hideFront){
    const k=C[id], P=pal(k.farba==="biela"), st=L.style, W=L.W, H=L.H, y0=L.feetH, t=4, g=part("skrinka",k.nazov);
    const fz=L.frontT; const fanOpts={frame:P.fan,blade:P.blade};
    // nohy
    for(const [fx,fw] of L.feet){ if(st==="north"){ boxAt(fx,0,24,fx+fw,y0,32,P.shell,g); boxAt(fx,0,D-32,fx+fw,y0,D-24,P.shell,g); boxAt(fx,y0-4,24,fx+fw,y0,D-24,P.shell,g); }
      else if(st==="c4000d") boxAt(fx,0,10,fx+fw,y0,D-10,P.edge,g);
      else { boxAt(fx,0,14,fx+fw,y0,44,P.edge,g); boxAt(fx,0,D-44,fx+fw,y0,D-14,P.edge,g); } }
    // dno, zadná stena, zadná bočnica
    boxAt(0,y0,0,W,y0+t,D,P.shell,g);
    boxAt(0,y0,0,t,H,D,P.shell,g);
    boxAt(0,y0,0,W,H,t,st==="nr200p"?P.dots:P.shell,g);
    // zadné záslepky slotov a I/O výrez
    const nsl=st==="nr200p"?3:(st==="o11"?8:7);
    for(let i=0;i<nsl;i++){ const yy=L.H-(st==="nr200p"?188:196)-i*20.32; boxAt(-1,yy-16,30,t-1,yy,D-50,M.metal,g); }
    boxAt(-.6,L.H-190,40,t,L.H-30,70,M.slot,g);
    // strop
    if(st==="north"){ boxAt(0,H-t,0,W,H,D,P.shell,g); for(let x=40;x<W-40;x+=10) boxAt(x,H-.2,20,x+5,H+.8,D-20,P.edge,g); }
    else if(st==="c4000d"||st==="h5"||st==="o11"){ boxAt(0,H-t,0,W,H,D,P.shell,g); boxAt(30,H-.6,18,W-40,H+1.2,D-18,st==="h5"?P.fine:P.dots,g); }
    else boxAt(0,H-t,0,W,H,D,P.dots,g);
    // predný panel
    if(st==="north"){ boxAt(W-26,y0,0,W-22,H,D,P.dots,g); for(let z=6;z<D-4;z+=11) boxAt(W-20,y0+4,z,W-2,H-4,z+7,z%22<11?M.wood:M.woodDark,g); }
    else if(st==="c4000d"){ boxAt(W-fz,y0,0,W-fz+3,H,D,P.shell,g); boxAt(W-8,y0+6,6,W,H-6,D-6,P.tri,g); boxAt(W-fz+3,y0+6,6,W-8,y0+10,D-6,P.edge,g);
      boxAt(W-fz,H-24,6,W,H-6,D-6,P.shell,g); }
    else if(st==="h5"){ boxAt(W-fz,y0,0,W-fz+3,H,D,P.shell,g); boxAt(W-5,y0+4,4,W,H-4,D-4,P.fine,g); }
    else if(st==="o11"){ const gl=boxAt(W-6,y0+4,4,W-2,H-4,D-4,P.glass,S.root); noPick(gl); boxAt(W-6,y0,0,W,y0+30,D,P.shell,g); boxAt(W-6,H-18,0,W,H,D,P.shell,g); boxAt(0,y0,D-4,W,y0+30,D,P.shell,g); }
    else boxAt(W-t,0,0,W,H,D,P.dots,g);
    // predné I/O a tlačidlo
    if(st==="c4000d"){ const b=cyl(5,3,M.metal,g,20); b.rotation.z=Math.PI/2; b.position.set(W-4,H-16,D/2-40); boxAt(W-2,H-19,D/2-10,W+.5,H-13,D/2+2,M.slot,g); boxAt(W-2,H-19,D/2+8,W+.5,H-13,D/2+20,M.slot,g); }
    else if(st!=="nr200p"&&st!=="o11"){ const b=cyl(5.5,3,M.metal,g,20); b.position.set(W-50,H+1,D/2); boxAt(W-90,H,D/2-4,W-78,H+1,D/2+4,M.slot,g); boxAt(W-110,H,D/2-4,W-98,H+1,D/2+4,M.slot,g); }
    else if(st==="o11"){ const b=cyl(5,3,M.metal,g,20); b.position.set(W-40,y0+15,D-1); b.rotation.x=Math.PI/2; }
    // rám skla
    const f=st==="north"?10:st==="c4000d"?8:st==="h5"?4:st==="o11"?0:8, z1=D-t;
    if(f){ boxAt(0,H-f,z1,W,H,D,P.edge,g); boxAt(0,y0,z1,W,y0+f,D,P.edge,g); boxAt(0,y0,z1,f,H,D,P.edge,g); boxAt(W-(st==="north"?26:fz),y0,z1,W-(st==="north"?22:fz-f),H,D,P.edge,g); }
    if(st==="h5"||st==="c4000d") boxAt(W-fz,y0,z1,W,H,D,P.shell,g);
    // ventilátory v balení
    const bT=D-4-k.maxChladic;
    for(const [x,y,w,h] of L.fans){ const vert=h>w, sz=vert?h:w, rear=vert&&x<W/2; if(hideFront&&vert&&!rear) continue;
      fanAt(g,sz,25,vert?"x":"y",x+w/2,L.H-(y+h/2),rear?Math.min(D-4-sz/2,bT+38+sz/2):D/2,Object.assign({caseFan:true},fanOpts)); }
    // O11: spodná mriežka pre ventilátory
    if(st==="o11"){ boxAt(t,y0+t,t,W-6,y0+t+2,D-t,P.dots,g); }
    // sklo
    if(S.glass){ const glw=st==="o11"?W-6:W-(st==="north"?26:fz); const gl=new T.Mesh(new T.BoxGeometry(glw,H-y0-(f?2*f:8),2),P.glass); gl.position.set(glw/2,y0+(H-y0)/2,D-1); noPick(gl); S.root.add(gl); }
    // kryt zdroja
    if(L.shroud){ const [x,y,w,h]=L.shroud; noPick(boxAt(x,L.H-(y+h),t+1,x+w,L.H-y,D-t,st==="h5"?P.fine:P.shroud,S.root)); noPick(boxAt(x,L.H-y-1.5,t+1,x+w,L.H-y,D-t,P.edge,S.root)); }
    return P;
  }

  /* ---------- hlavné zostavenie ---------- */
  function build(b){
    const k=C[b.skrinka], L=LAYOUT[b.skrinka], W=L.W, H=L.H, D=k.sirka;
    const bad=new Set(); checks(b).filter(x=>!x.ok).forEach(x=>x.cats.forEach(c=>bad.add(c)));
    const changed=new Set(); if(S.prev) for(const kk of KAT) if(JSON.stringify(S.prev[kk.id])!==JSON.stringify(b[kk.id])) changed.add(kk.id);
    clear(); S.root=new T.Group(); S.root.position.set(-W/2,0,-D/2); scene.add(S.root);
    const sh=new T.Mesh(new T.PlaneGeometry(W*1.9,D*2.6),M.shadow); sh.rotation.x=-Math.PI/2; sh.position.set(W/2,.5,D/2); noPick(sh); S.root.add(sh);
    const P=buildCase(b.skrinka,L,D,radFrontMounted(k,C[b.chladic]));
    const boardTop=D-4-k.maxChladic;
    inner.position.set(0,H*.6,boardTop+60-D/2);
    const Y=y=>L.H-y;
    const d=C[b.doska]; const BD=d?BOARD[d.ff]:BOARD.ATX; const [bx,by]=L.board; const slotY=by+BD.slot;
    boxAt(4,L.shroud?Y(L.shroud[1]):L.feetH+4,boardTop-9,Math.min(W-30,bx+BD.w+(L.style==="o11"?120:40)),H-4,boardTop-8,P.tray,S.root);
    // --- doska
    if(d){ const g=part("doska",d.nazov); const hs=d.tone==="silver"?M.hsSilver:d.tone==="white"?M.hsWhite:M.hsDark;
      const R=(ox,oy,w,h,z0,z1,mat)=>boxAt(bx+ox,Y(by+oy+h),boardTop+z0,bx+ox+w,Y(by+oy),boardTop+z1,mat,g);
      R(0,0,BD.w,BD.h,-1.6,0,d.tone==="dark"?M.pcb:M.pcbDark);
      BD.vrm.forEach(v=>R(v[0],v[1],v[2],v[3],0,24,hs)); R(BD.io[0],BD.io[1],BD.io[2],BD.io[3],0,36,hs);
      if(BD.chip){ R(BD.chip[0],BD.chip[1],BD.chip[2],BD.chip[3],0,9,hs); const lb=label(d.cipset,BD.chip[2]*.9,BD.chip[3]*.4,{fg:d.tone==="dark"?"#cfd6d3":"#2a2f30",size:120}); lb.position.set(bx+BD.chip[0]+BD.chip[2]/2,Y(by+BD.chip[1]+BD.chip[3]/2),boardTop+9.2); g.add(lb); }
      const [sx,sy]=BD.socket; R(sx-BD.sock/2-4,sy-BD.sock/2-4,BD.sock+8,BD.sock+8,0,3,M.socket);
      BD.ram.forEach(rx=>R(rx-.5,BD.ramY[0],7,BD.ramY[1]-BD.ramY[0],0,7,M.slot));
      R(12,BD.slot-3,Math.min(160,BD.w-30),6,0,11,M.slot); (BD.slots2||[]).forEach(y2=>R(12,y2-2,150,5,0,10,M.slot));
      const nv=(b.ulozisko||[]).filter(i=>C[i].typ==="NVMe").length;
      BD.m2.forEach((m,i)=>{ if(m[2]&&i>=nv) R(m[0],m[1],m[2],m[3],0,3.5,hs); });
      const lb=label(ffName(d.ff)+" · "+d.socket,90,12,{fg:"#9fb3ab",size:70,weight:700}); lb.position.set(bx+BD.w-50,Y(by+BD.h-10),boardTop+.2); g.add(lb);
    }
    const [sx,sy]=BD.socket; const cx=bx+sx, cy=Y(by+sy);
    // --- NVMe
    const nvs=(b.ulozisko||[]).filter(i=>C[i].typ==="NVMe");
    if(nvs.length&&d){ const g=part("ulozisko",nvs.map(i=>C[i].nazov).join(", "));
      BD.m2.slice(0,nvs.length).forEach(m=>{ if(!m[2]) return; boxAt(bx+m[0],Y(by+m[1]+m[3]),boardTop+.5,bx+m[0]+m[2],Y(by+m[1]),boardTop+4.5,M.ssd,g);
        const lb=label("NVMe",m[2]*.6,m[3]*.7,{size:90}); lb.position.set(bx+m[0]+m[2]*.45,Y(by+m[1]+m[3]/2),boardTop+4.7); g.add(lb); }); }
    // --- procesor
    const c=C[b.procesor];
    if(c&&d){ const g=part("procesor",c.nazov); boxAt(cx-22,cy-22,boardTop+3,cx+22,cy+22,boardTop+7,M.ihs,g); }
    // --- RAM
    const r=C[b.pamat];
    if(r&&d){ const g=part("pamat",r.nazov); const lift=bad.has("pamat")?18:0; const body=r.farba==="strieborna"?M.hsSilver:M.ram; const hgt=r.rgb?44:34;
      BD.ramUse.slice(0,r.moduly).forEach(ix=>{ const x=bx+BD.ram[ix]; boxAt(x-.5,Y(by+BD.ramY[1])-2,boardTop+5+lift,x+6.5,Y(by+BD.ramY[0])+2,boardTop+hgt+lift,body,g);
        boxAt(x,Y(by+BD.ramY[1])+2,boardTop+hgt-2+lift,x+6,Y(by+BD.ramY[0])-2,boardTop+hgt+4+lift,r.rgb?M.rgb:(r.typ==="DDR5"?M.ddr5:M.ddr4),g); }); }
    // --- chladič
    const ch=C[b.chladic];
    if(ch&&d){ const g=part("chladic",ch.nazov);
      if(ch.druh==="vezovy"){ const top=boardTop+ch.vyska, wd=ch.sirka||150, tw=(wd-50)/2, dep=(ch.fan||140)/2+6, fs=ch.fan||140;
        const black=ch.id.startsWith("Thermalright"); const fm=black?M.finsBlack:M.fins;
        boxAt(cx-20,cy-20,boardTop+7,cx+20,cy+20,boardTop+14,M.copper,g);
        [cx-wd/2, cx-wd/2+tw+25].forEach(x0=>{ const x1=x0+tw;
          for(let z=boardTop+44;z<top-4;z+=4.2) boxAt(x0,cy-dep,z,x1,cy+dep,z+.9,fm,g);
          boxAt(x0,cy-dep,top-4,x1,cy+dep,top,fm,g);
          for(let i=0;i<3;i++){ const hp=cyl(3,top-boardTop-18,M.copper,g,12); hp.rotation.x=Math.PI/2; hp.position.set(x0+tw*.25+i*tw*.25,cy+(i%2?dep*.3:-dep*.3),(boardTop+16+top)/2); } });
        [cx-wd/2+tw+12.5, cx+wd/2-12.5].forEach(fx=>fanAt(g,fs,25,"x",fx,cy,top-fs/2-2,{rgb:false,frame:black?M.fanFrame:M.nocFrame,blade:black?M.blade:M.nocBlade}));
      } else if(ch.druh==="nizky"){ const top=boardTop+ch.vyska;
        boxAt(cx-20,cy-20,boardTop+7,cx+20,cy+20,boardTop+12,M.copper,g);
        for(let i=0;i<14;i++){ const x=cx-47+i*7; boxAt(x,cy-47,boardTop+12,x+1.2,cy+47,top-14,M.fins,g); }
        fanAt(g,92,14,"z",cx,cy,top-7,{rgb:false,frame:M.nocFrame,blade:M.nocBlade});
      } else { // AIO
        const pz=boardTop+7; const pump=cyl(30,38,M.pump,g,40); pump.rotation.x=Math.PI/2; pump.position.set(cx,cy,pz+19);
        const cap=new T.Mesh(new T.TorusGeometry(24,2,8,48),M.rgb); cap.position.set(cx,cy,pz+38.5); g.add(cap);
        const loc=radiatorMount(k,ch.radiator)||Object.keys(L.rad)[0]; const [rx,ry,dir]=L.rad[loc]; const rl=ch.radiator+38, n=ch.radiator/120|0;
        const zc=Math.min(D-70,(boardTop+D)/2+18); let end;
        if(dir==="h"||dir==="b"){ const bottom=dir==="b"; const yB=bottom?L.feetH+6:Y(ry)-27, yT=yB+27;
          boxAt(rx,yB,zc-60,rx+rl,yT,zc+60,M.rad,g); for(let x=rx+6;x<rx+rl-6;x+=6) boxAt(x,yB-.3,zc-56,x+1,yT+.3,zc+56,M.finsBlack,g);
          for(let i=0;i<n;i++) fanAt(g,120,25,"y",rx+19+60+i*120,bottom?yT+12.5:yB-12.5,zc,{rgb:true});
          end=new T.Vector3(rx+rl-12,bottom?yT:yB,zc-30);
        } else if(dir==="s"){ const zR1=D-6, zR0=zR1-27, yT=Y(ry), yB=yT-120;
          boxAt(rx,yB,zR0,rx+rl,yT,zR1,M.rad,g); for(let x=rx+6;x<rx+rl-6;x+=6) boxAt(x,yB+4,zR0-.3,x+1,yT-4,zR1+.3,M.finsBlack,g);
          for(let i=0;i<n;i++) fanAt(g,120,25,"z",rx+19+60+i*120,yB+60,zR0-12.5,{rgb:true});
          end=new T.Vector3(rx+rl-14,yB+14,zR0-26);
        } else { const xR=rx+25, yT=Y(ry), yB=yT-rl;
          boxAt(xR,yB,zc-60,xR+27,yT,zc+60,M.rad,g); for(let y=yB+6;y<yT-6;y+=6) boxAt(xR-.3,y,zc-56,xR+27.3,y+1,zc+56,M.finsBlack,g);
          for(let i=0;i<n;i++) fanAt(g,120,25,"x",xR-12.5,yT-19-60-i*120,zc,{rgb:true});
          end=new T.Vector3(xR,yB+14,zc-30); }
        [0,1].forEach(i=>{ const a=new T.Vector3(cx+(i?10:-10),cy+24,pz+30), e=end.clone().add(new T.Vector3(0,0,i*22));
          const curve=new T.CatmullRomCurve3([a,new T.Vector3(a.x,a.y+60,a.z+30),new T.Vector3((a.x+e.x)/2,Math.max(a.y,e.y)+20,(a.z+e.z)/2+20),e]);
          g.add(new T.Mesh(new T.TubeGeometry(curve,32,5.5,10,false),M.tube)); });
      }
    }
    // --- grafika
    const gk=b.grafika?C[b.grafika]:null;
    if(gk&&d){ const g=part("grafika",gk.nazov); const GS=GPU_STYLE[gk.styl]||GPU_STYLE.fe; const x0=L.bracketX, len=gk.dlzka, th=gk.sloty*20.32, hk=gk.vyska||120;
      const yTop=Y(slotY+4), yBot=yTop-th, z0=boardTop+2, z1=z0+hk;
      boxAt(x0-3,yBot-6,z0-6,x0,yTop+4,z0+118,M.metal,g);
      boxAt(x0,yBot+2,z0,x0+len,yTop,z1,GS.body,g);
      boxAt(x0+4,yBot+1,z0+6,x0+len-4,yBot+3,z1-6,M.fins,g);
      boxAt(x0,yTop-.5,z0+2,x0+len,yTop+1.5,z1-2,gk.styl==="pulse"?M.hsDark:GS.trim,g);
      if(gk.styl==="fe"||gk.styl==="astral") boxAt(x0,yBot+2,z1-.1,x0+len,yTop,z1+1.5,GS.trim,g);
      if(gk.styl==="pulse") boxAt(x0+len*.05,yBot+th*.35,z1,x0+len*.95,yBot+th*.4,z1+1.2,GS.trim,g);
      if(gk.styl==="dual"||gk.styl==="ventus"){ boxAt(x0+len*.1,yBot+th*.2,z1,x0+len*.9,yBot+th*.24,z1+1,GS.trim,g); boxAt(x0+len*.1,yBot+th*.75,z1,x0+len*.9,yBot+th*.79,z1+1,GS.trim,g); }
      if(gk.styl==="astral") boxAt(x0+len*.55,yBot+4,z1+1.5,x0+len*.95,yTop-4,z1+3,M.hsDark,g);
      if(GS.strip) boxAt(x0+len*.08,yTop-2,z1-6,x0+len*.92,yTop-.5,z1+1.6,M.rgb,g);
      const n=gk.fans, pos=n===3?[.18,.5,.82]:[.26,.74], fs=Math.min(hk*.84,len/n*.92);
      pos.forEach(p=>fanAt(g,fs,10,"y",x0+len*p,yBot-3,(z0+z1)/2,{rgb:gk.styl==="astral"}));
      const lb=label((gk.nazov.match(/(RTX|RX) \d{4}( Ti| XT)?/)||[shortName(gk)])[0],Math.min(160,len*.5),th*.4,{size:74}); lb.position.set(x0+len*.28,yBot+th*.55,z1+1.8+(gk.styl==="astral"||gk.styl==="fe"?1.5:0)); g.add(lb);
      boxAt(x0+len*.55,yTop,z1-30,x0+len*.62,yTop+8,z1-14,M.slot,g);
      if(activeCat==="grafika"||bad.has("grafika")){ const lx=x0+k.maxGpu; const pl=new T.Mesh(new T.PlaneGeometry(D-boardTop-10,th+60),bad.has("grafika")?M.limitBad:M.limitOk);
        pl.rotation.y=Math.PI/2; pl.position.set(lx,yBot+th/2,(boardTop+D-4)/2); noPick(pl); S.root.add(pl);
        S.limitLabel={pos:new T.Vector3(lx,yTop+34,D-4),text:`limit ${k.maxGpu} mm · karta ${gk.dlzka} mm`,bad:bad.has("grafika")}; }
    }
    // --- zdroj
    const z=C[b.zdroj];
    if(z){ const g=part("zdroj",z.nazov); const [x,y,w,h]=L.psu[z.ff]||L.psu.ATX; const depth=z.ff==="ATX"?140:100;
      const zz0=L.psuBehind?8:12, zz1=L.psuBehind?Math.min(boardTop-12,zz0+h):zz0+depth;
      const yb=Y(y+h), yt=L.psuBehind?yb+Math.min(depth,h+54):Y(y);
      boxAt(x,yb,zz0,x+w,yt,zz1,M.psu,g);
      for(let i=0;i<6;i++) boxAt(x+w-40+i*6,yb+6,zz1,x+w-37+i*6,yt-6,zz1+.8,M.hsDark,g);
      const lb=label(`${z.w} W  ${z.ff}`,Math.min(90,w*.6),(yt-yb)*.3,{size:84}); lb.position.set(x+w*.36,(yb+yt)/2,zz1+1); g.add(lb);
      if(z.ff!=="ATX"&&L.psu.ATX&&!L.psuBehind&&L.style!=="nr200p"){ const [ax,ay,aw,ah]=L.psu.ATX; boxAt(ax,Y(ay+ah),zz0-2,ax+2,Y(ay),zz0+140,M.metal,g); boxAt(ax+aw-2,Y(ay+ah),zz0-2,ax+aw,Y(ay),zz0+140,M.metal,g); }
    }
    // --- SATA SSD a HDD
    const sata=(b.ulozisko||[]).filter(i=>C[i].typ==="SATA");
    if(sata.length){ const g=part("ulozisko",sata.map(i=>C[i].nazov).join(", ")); const [x,y,w,h]=L.sata;
      const sz0=L.sataZ!=null?L.sataZ:boardTop-1; boxAt(x,Y(y+h),sz0,x+w,Y(y),sz0+7,M.sata,g); const lb=label("SATA SSD",w*.7,h*.3,{size:80}); lb.position.set(x+w/2,Y(y+h/2),sz0+7.3); g.add(lb); }
    const hdd=(b.ulozisko||[]).filter(i=>C[i].typ==="HDD");
    if(hdd.length){ const g=part("ulozisko",hdd.map(i=>C[i].nazov).join(", ")); const x=hddX(L), y=L.hdd[1]; const zc=L.hddZ!=null?L.hddZ+51:Math.min(D/2+20,D-60);
      boxAt(x,Y(y)-26,zc-51,x+147,Y(y),zc+51,M.hdd,g); boxAt(x+2,Y(y)-24,zc+51,x+145,Y(y)-2,zc+52,M.ssd,g); const lb=label("HDD 3,5\"",60,10,{size:80}); lb.position.set(x+50,Y(y)-13,zc+52.5); g.add(lb); }

    // --- zvýraznenia a animácie
    S.root.updateMatrixWorld(true);
    for(const [cat,gs] of Object.entries(S.groups)){
      if(changed.has(cat)||(cat==="procesor"&&changed.has("chladic"))) gs.forEach(g=>{ g.userData.pop=performance.now(); S.pops.push(g); });
      if(bad.has(cat)) gs.forEach(g=>addHelper(g,0xf06a55,true)); else if(activeCat===cat&&cat!=="skrinka") gs.forEach(g=>addHelper(g,0x46a97f,false));
    }
    if(S.caseId!==b.skrinka){ const first=!S.caseId; S.caseId=b.skrinka; S.tDist=fitDist(); S.target.set(0,H*.5,0); if(first) S.dist=S.tDist; }
    S.prev=structuredClone(b); S.prevFull=b;
  }
  function addHelper(g,color,badge){ const bx=new T.Box3().setFromObject(g); if(bx.isEmpty()) return; bx.expandByScalar(3);
    const h=new T.Box3Helper(bx,color); noPick(h); scene.add(h); S.helpers.push(h);
    if(badge){ const el=document.createElement("div"); el.className="badge3d"; el.textContent="!"; ovl.appendChild(el); S.badges.push({el,pos:new T.Vector3((bx.min.x+bx.max.x)/2,bx.max.y,(bx.min.z+bx.max.z)/2)}); } }
  function clear(){
    if(S.root){ S.root.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); scene.remove(S.root); }
    S.helpers.forEach(h=>{ scene.remove(h); h.geometry.dispose(); }); S.helpers=[];
    S.badges.forEach(b=>b.el.remove()); S.badges=[]; S.disposables.forEach(x=>x.dispose()); S.disposables=[];
    S.spin=[]; S.pops=[]; S.groups={}; S.limitLabel=null; ovl.querySelectorAll(".lim3d").forEach(e=>e.remove());
    if(S.hoverHelper){ scene.remove(S.hoverHelper); S.hoverHelper=null; } S.hover=null;
  }

  /* ---------- kamera a ovládanie ---------- */
  const ptrs=new Map(); let downAt=null, moved=0, pinch0=0;
  function place(){ const ce=Math.cos(S.el); camera.position.set(S.target.x+S.dist*ce*Math.sin(S.az), S.target.y+S.dist*Math.sin(S.el), S.target.z+S.dist*ce*Math.cos(S.az)); camera.lookAt(S.target); }
  canvas.addEventListener("pointerdown",e=>{ canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); downAt={x:e.clientX,y:e.clientY}; moved=0; S.auto=false; syncTools();
    if(ptrs.size===2){ const [a,b2]=[...ptrs.values()]; pinch0=Math.hypot(a.x-b2.x,a.y-b2.y); } canvas.classList.add("grabbing"); });
  canvas.addEventListener("pointermove",e=>{
    if(!ptrs.has(e.pointerId)){ hoverAt(e); return; }
    const p=ptrs.get(e.pointerId); const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
    if(ptrs.size===1){ S.tAz-=dx*.009; S.tEl=Math.max(-.12,Math.min(1.45,S.tEl+dy*.007)); }
    else if(ptrs.size===2){ const [a,b2]=[...ptrs.values()]; const dd=Math.hypot(a.x-b2.x,a.y-b2.y); if(pinch0) zoom(pinch0/dd); pinch0=dd; }
    tip.hidden=true; });
  const up=e=>{ if(!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); canvas.classList.remove("grabbing");
    if(ptrs.size===0 && moved<7 && downAt && e.type==="pointerup"){ const hitCat=pick(e); if(hitCat && typeof window.klikNaDiel==="function") window.klikNaDiel(hitCat); } pinch0=0; };
  canvas.addEventListener("pointerup",up); canvas.addEventListener("pointercancel",up);
  canvas.addEventListener("pointerleave",()=>{ tip.hidden=true; setHover(null); });
  canvas.addEventListener("wheel",e=>{ e.preventDefault(); zoom(Math.exp(e.deltaY*.0012)); },{passive:false});
  canvas.addEventListener("dblclick",()=>view(0));
  function fitDist(){ const id=S.caseId||Object.keys(LAYOUT).find(k=>C[k]); return Math.max(LAYOUT[id].W,LAYOUT[id].H*1.1,C[id].sirka)*2.05*Math.max(1,1.05/(camera.aspect||1.4)); }
  function zoom(f){ const base=S.caseId?Math.max(LAYOUT[S.caseId].W,LAYOUT[S.caseId].H):450; S.tDist=Math.max(base*1.05,Math.min(base*5,S.tDist*f)); }
  const ray=new T.Raycaster(), ndc=new T.Vector2();
  function hitAt(e){ const r=canvas.getBoundingClientRect(); ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
    const hits=S.root?ray.intersectObjects(S.root.children,true):[]; for(const h of hits){ let o=h.object; while(o&&!o.userData.cat) o=o.parent; if(o) return o; } return null; }
  function pick(e){ const o=hitAt(e); return o?o.userData.cat:null; }
  function setHover(o){ const cat=o?o.userData.cat:null; if(cat===S.hover) return; S.hover=cat; if(S.hoverHelper){ scene.remove(S.hoverHelper); S.hoverHelper.geometry.dispose(); S.hoverHelper=null; }
    if(cat&&cat!=="skrinka"){ const bx=new T.Box3(); (S.groups[cat]||[]).forEach(g=>bx.expandByObject(g)); bx.expandByScalar(4); S.hoverHelper=new T.Box3Helper(bx,0xcfe9dc); scene.add(S.hoverHelper); }
    canvas.style.cursor=cat?"pointer":"grab"; }
  function hoverAt(e){ if(e.pointerType==="touch") return; const o=hitAt(e); setHover(o);
    if(o){ const r=host.getBoundingClientRect(); tip.hidden=false; tip.innerHTML=`<b>${esc(KATMAP[o.userData.cat].nazov)}</b><br>${esc(o.userData.name)}`; tip.style.left=Math.min(r.width-200,e.clientX-r.left+14)+"px"; tip.style.top=(e.clientY-r.top+14)+"px"; }
    else tip.hidden=true; }
  const VIEWS=[{n:"3/4 pohľad",az:.72,el:.26},{n:"Cez sklo",az:0,el:.05},{n:"Spredu",az:Math.PI/2,el:.08},{n:"Zhora",az:.25,el:1.3},{n:"Zozadu",az:-2.3,el:.25}];
  let vi=0; function view(i){ vi=i%VIEWS.length; const v=VIEWS[vi]; let a=v.az; while(a-S.tAz>Math.PI) a-=2*Math.PI; while(S.tAz-a>Math.PI) a+=2*Math.PI; S.tAz=a; S.tEl=v.el; S.tDist=fitDist(); syncTools(); }

  /* ---------- nástroje ---------- */
  const tools=document.getElementById("tools3d");
  function syncTools(){ if(!tools) return; tools.querySelector('[data-t="spin"]').setAttribute("aria-pressed",S.auto); tools.querySelector('[data-t="glass"]').setAttribute("aria-pressed",S.glass);
    tools.querySelector('[data-t="rgb"] span').textContent=S.rgb?["","zelená","modrá","fialová","oranžová","biela"][S.rgb]:"vyp."; tools.querySelector('[data-t="view"] span').textContent=VIEWS[vi].n; }
  if(tools) tools.addEventListener("click",e=>{ const b2=e.target.closest("button"); if(!b2) return; const t=b2.dataset.t;
    if(t==="spin") S.auto=!S.auto;
    if(t==="glass"){ S.glass=!S.glass; build(S.prevFull); }
    if(t==="rgb"){ S.rgb=(S.rgb+1)%RGB.length; applyRgb(); }
    if(t==="view") view(vi+1);
    syncTools(); });
  function applyRgb(){ const c=RGB[S.rgb]; if(c){ M.rgb.color.copy(lin(c)); M.rgb.emissive.copy(lin(c)); } else { M.rgb.color.copy(lin(0x222222)); M.rgb.emissive.set(0x000000); } }

  /* ---------- slučka ---------- */
  const tmp=new T.Vector3();
  function proj(v,world){ tmp.copy(v); if(!world&&S.root) S.root.localToWorld(tmp); tmp.project(camera); const r=host.getBoundingClientRect(); return {x:(tmp.x*.5+.5)*r.width,y:(-tmp.y*.5+.5)*r.height,vis:tmp.z<1}; }
  function frame(now){
    const dt=Math.min(.05,(now-S.last)/1000); S.last=now;
    if(S.visible&&!document.hidden){
      if(S.auto&&!ptrs.size) S.tAz+=dt*.18;
      const kf=1-Math.pow(.0015,dt); S.az+=(S.tAz-S.az)*kf; S.el+=(S.tEl-S.el)*kf; S.dist+=(S.tDist-S.dist)*kf; place();
      if(!reduce) S.spin.forEach(r=>r.rotation.z+=dt*9);
      S.pops=S.pops.filter(g=>{ const p=Math.min(1,(now-g.userData.pop)/420); const e=1-Math.pow(1-p,3); g.scale.setScalar(.86+.14*e); g.position.y=(1-e)*28; return p<1; });
      renderer.render(scene,camera);
      const behind=(camera.position.z-S.target.z)<-40; ovl.style.visibility=behind?"hidden":"visible";
      for(const bd of S.badges){ const p=proj(bd.pos,true); bd.el.style.transform=`translate(${p.x-11}px,${p.y-30}px)`; bd.el.hidden=!p.vis; }
      if(S.limitLabel){ let el=ovl.querySelector(".lim3d"); if(!el){ el=document.createElement("div"); el.className="lim3d"+(S.limitLabel.bad?" bad":""); el.textContent=S.limitLabel.text; ovl.appendChild(el); }
        const p=proj(S.limitLabel.pos); el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`; }
    }
    requestAnimationFrame(frame);
  }
  function resize(){ const r=host.getBoundingClientRect(); if(!r.width) return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(es=>{ S.visible=es[0].isIntersecting; }).observe(host);
  resize(); requestAnimationFrame(frame); syncTools();
  return {ok:true, render:b=>{ build(b); resize(); }, auto:v=>{ S.auto=v; syncTools(); }, _debug:()=>({groups:S.groups, root:S.root, T})};
})();

