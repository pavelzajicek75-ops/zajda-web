/* star-map.js — hvězdná mapa milníků (stránka /timeline/).
   Samostatný modul: StarMap.open(milestones, {selectId, onList}) postaví celoobrazovkový
   přehled milníků jako souhvězdí. Data bere z /api/timeline/list (už načtená stránkou). */
(function () {
  'use strict';
  var CSS = "#smap{--bg:#05030f;--ink:#cfeee9;--dim:#7f9a98;--acc:#f2b8ff;--teal:#5ff0dc;--mono:Space Grotesk,system-ui,sans-serif}\n#smap *{box-sizing:border-box}\n#smap canvas#c{position:fixed;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;display:block}\n#smap .vig{position:fixed;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(2,1,8,.75) 100%)}\n#smap .scan{position:fixed;inset:0;pointer-events:none;opacity:.05;background:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px)}\n#smap .cn{position:fixed;width:20px;height:20px;border:1px solid rgba(95,240,220,.45);pointer-events:none;z-index:4}\n#smap .cn.a{top:10px;left:10px;border-right:0;border-bottom:0}\n#smap .cn.b{top:10px;right:10px;border-left:0;border-bottom:0}\n#smap .cn.c{bottom:10px;left:10px;border-right:0;border-top:0}\n#smap .cn.d{bottom:10px;right:10px;border-left:0;border-top:0}\n#smap header{position:fixed;top:0;left:0;right:0;z-index:5;display:flex;justify-content:space-between;align-items:flex-start;padding:22px 28px;pointer-events:none}\n#smap header .tt{font:600 11px/1.5 var(--mono);letter-spacing:.2em;color:var(--dim);text-transform:uppercase}\n#smap header .tt b{color:var(--acc);font-weight:600}\n#smap header .tt small{display:block;font-size:9.5px;letter-spacing:.16em;color:#4f6a68}\n#smap header .bt{display:flex;gap:8px;pointer-events:auto}\n#smap header button{all:unset;white-space:nowrap;cursor:pointer;font:600 10.5px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim);border:1px solid #2b3a3a;padding:8px 11px;border-radius:2px;background:rgba(5,6,14,.5)}\n#smap header button:hover,#smap header button:focus-visible{color:#fff;border-color:var(--teal)}\n#smap #boot{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;font:12px/2 var(--mono);letter-spacing:.2em;color:var(--teal);text-transform:uppercase;pointer-events:none;animation:smbootout .6s ease 2.6s forwards}\n#smap #boot div{opacity:0;animation:smbin .01s forwards}\n#smap #boot div:nth-child(1){animation-delay:.1s}\n#smap #boot div:nth-child(2){animation-delay:.7s}\n#smap #boot div:nth-child(3){animation-delay:1.3s}\n#smap #boot i{display:inline-block;width:8px;height:13px;background:var(--teal);vertical-align:-2px;animation:smbl .6s steps(2) infinite}\n@keyframes smbin{to{opacity:1}}\n@keyframes smbl{50%{opacity:0}}\n@keyframes smbootout{to{opacity:0;visibility:hidden}}\n#smap #hud{position:fixed;left:28px;bottom:26px;z-index:5;font:10px/1.7 var(--mono);letter-spacing:.14em;color:#4f6a68;text-transform:uppercase;pointer-events:none}\n#smap #legend{position:fixed;left:28px;bottom:22px;z-index:5;display:flex;gap:6px;flex-wrap:wrap}\n#smap #legend button{all:unset;cursor:pointer;font:600 10px/1 var(--mono);letter-spacing:.12em;color:var(--dim);text-transform:uppercase;padding:6px 8px;border:1px solid transparent;border-radius:2px;display:flex;align-items:center;gap:6px;transition:.25s}\n#smap #legend button:hover,#smap #legend button:focus-visible{border-color:#2b3a3a;color:#fff}\n#smap #legend button.on{border-color:currentColor;color:#fff}\n#smap #legend button.off{opacity:.35}\n#smap #legend i{width:8px;height:8px;border-radius:50%;display:block}\n#smap #hint{position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:4;font:10px var(--mono);letter-spacing:.2em;color:#58807c;text-transform:uppercase;transition:opacity .8s;white-space:nowrap;pointer-events:none;opacity:0}\n#smap #tl{position:fixed;z-index:5;right:28px;bottom:26px;width:min(460px,42vw);height:38px;user-select:none}\n#smap #tl .ln{position:absolute;left:8px;right:8px;top:14px;height:1px;background:linear-gradient(90deg,rgba(95,240,220,.1),rgba(95,240,220,.5) 90%,rgba(242,184,255,.9))}\n#smap #tl .tk{position:absolute;top:14px;width:1px;height:6px;background:#355;transform:translateX(-.5px)}\n#smap #tl .tk span{position:absolute;top:9px;left:50%;transform:translateX(-50%);font:9px var(--mono);color:#4f6a68;letter-spacing:.08em}\n#smap #tl button{all:unset;cursor:pointer;position:absolute;top:8px;width:13px;height:13px;margin-left:-5px;border-radius:50%;transition:transform .25s,box-shadow .25s;box-shadow:0 0 6px currentColor;background:currentColor}\n#smap #tl button:hover{transform:scale(1.35)}\n#smap #tl button.sel{transform:scale(1.7);box-shadow:0 0 14px currentColor,0 0 0 3px rgba(255,255,255,.25)}\n#smap #card{position:fixed;z-index:6;right:28px;top:50%;width:clamp(500px,40vw,660px);max-width:calc(100vw - 32px);transform:translateY(-46%);opacity:0;pointer-events:none;\n    background:linear-gradient(180deg,rgba(10,13,26,.9),rgba(6,8,18,.86));backdrop-filter:blur(10px);border:1px solid #1f3234;border-radius:3px;padding:36px 40px 24px;transition:opacity .4s,transform .4s;\n    box-shadow:0 0 0 1px rgba(95,240,220,.04),0 20px 60px rgba(0,0,0,.6)}\n#smap #card::before,#smap #card::after{content:'';position:absolute;width:14px;height:14px;border:1px solid var(--cc,#5ff0dc);pointer-events:none}\n#smap #card::before{top:-1px;left:-1px;border-right:0;border-bottom:0}\n#smap #card::after{bottom:-1px;right:-1px;border-left:0;border-top:0}\n#smap #card.on{opacity:1;transform:translateY(-50%);pointer-events:auto}\n#smap #card .meta{font:600 12.5px var(--mono);letter-spacing:.2em;text-transform:uppercase;display:flex;gap:10px;align-items:center;margin-bottom:18px}\n#smap #card .dot{width:8px;height:8px;border-radius:50%}\n#smap #card h2{margin:0 0 16px;font:600 clamp(30px,2.5vw,38px)/1.2 Space Grotesk,system-ui,sans-serif;color:#fff}\n#smap #card p{margin:0 0 26px;font-size:clamp(17px,1.35vw,20px);line-height:1.68;color:#b9d0ce}\n#smap .tele{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:0 0 14px;padding:10px 0;border-top:1px dashed #1f3234;border-bottom:1px dashed #1f3234}\n#smap .tele div{font:11px/1.4 var(--mono);letter-spacing:.14em;color:#4f6a68;text-transform:uppercase}\n#smap .tele b{display:block;font:600 15px/1.4 var(--mono);letter-spacing:.06em;color:var(--ink);margin-top:2px;text-transform:none}\n#smap #card a{color:var(--acc);font-size:15.5px;text-decoration:none}\n#smap #card a:hover{text-decoration:underline}\n#smap .nav{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:16px;font:12px var(--mono);letter-spacing:.1em;color:var(--dim)}\n#smap .nav button{all:unset;cursor:pointer;padding:10px 16px;border:1px solid #2b3a3a;border-radius:2px;color:var(--ink);text-transform:uppercase;font-size:12px;letter-spacing:.14em}\n#smap .nav button:hover,#smap .nav button:focus-visible{border-color:var(--teal);color:#fff}\n#smap .nav button:disabled{opacity:.25;cursor:default;border-color:#2b3a3a}\n#smap #list{position:fixed;inset:0;z-index:9;background:rgba(5,3,15,.97);padding:80px 22px 30px;overflow:auto;display:none}\n#smap #list.on{display:block}\n#smap #list ol{max-width:620px;margin:0 auto;padding:0;list-style:none}\n#smap #list li{padding:14px 0;border-bottom:1px solid #1c2a2c}\n#smap #list li small{font:11px var(--mono);color:var(--dim);letter-spacing:.1em}\n#smap #list li h3{margin:4px 0;font:600 18px Space Grotesk,system-ui,sans-serif}\n#smap #list li p{margin:0;color:#a9c0be;font-size:14px;line-height:1.5}\n@media (max-width:760px){#smap header{padding:18px 18px}\n#smap header .tt small{display:none}\n#smap header .tt{font-size:10px;letter-spacing:.14em}\n#smap header button{padding:7px 8px;font-size:10px;letter-spacing:.1em}\n#smap #hud,#smap #legend{display:none}\n#smap #tl{left:18px;right:18px;width:auto;top:56px;bottom:auto}\n#smap #hint{top:104px}\n#smap #card{right:0;left:0;top:34vh;bottom:0;height:auto;width:100%;max-width:none;border-radius:14px 14px 0 0;transform:translateY(30px);padding:20px 20px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column}\n#smap #card.on{transform:translateY(0)}\n#smap #card h2{font-size:25px;margin-bottom:12px}\n#smap #card p{font-size:16px;margin-bottom:16px}\n#smap .cn{display:none}}\n@media (prefers-reduced-motion:reduce){#smap #boot{display:none}\n#smap #card{transition:none}}\n#smap{position:fixed;inset:0;z-index:100;background:#05030f;color:#cfeee9;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden;line-height:1.4;text-align:left}\n#smap[hidden]{display:none}\n#smap .ph{display:flex;gap:6px;margin:0 0 14px}\n#smap .ph:empty{display:none}\n#smap .ph img{flex:1 1 0;min-width:0;height:clamp(130px,17vh,190px);object-fit:cover;border-radius:3px;cursor:zoom-in;border:1px solid #1f3234;display:block}\n#smap .sh{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}\n#smap .sh button,#smap .sh a{all:unset;cursor:pointer;font:600 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink);border:1px solid #2b3a3a;padding:10px 14px;border-radius:2px}\n#smap .sh button:hover,#smap .sh a:hover{border-color:var(--teal);color:#fff}\n#smap .sh .copied{color:var(--teal);border-color:var(--teal)}\n#smap #card{max-height:calc(100vh - 150px);overflow:auto;scrollbar-width:none}\n#smap #card::-webkit-scrollbar{display:none}\n#smap header a{all:unset;cursor:pointer;font:600 10.5px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim);border:1px solid #2b3a3a;padding:8px 11px;border-radius:2px;background:rgba(5,6,14,.5);white-space:nowrap}\n#smap header a:hover{color:#fff;border-color:var(--teal)}\n#smap .qsig{position:fixed;left:28px;bottom:124px;z-index:5;max-width:min(480px,36vw);cursor:pointer;opacity:0;transition:opacity 1s;text-decoration:none;display:block;padding:14px 18px;background:rgba(5,6,14,.62);backdrop-filter:blur(8px);border-left:2px solid var(--teal);border-radius:0 6px 6px 0}#smap .qsig.on{opacity:1}#smap .qs-h{font:600 10.5px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--teal);margin-bottom:7px;opacity:.85}#smap .qs-t{font:300 italic clamp(16px,1.35vw,20px)/1.5 Inter,system-ui,sans-serif;color:#d8f3ee;text-shadow:0 0 18px rgba(95,240,220,.25)}#smap .qs-a{font:600 11.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--acc);margin-top:7px;min-height:1em}#smap .qsig:hover .qs-t{color:#fff}@media (max-width:760px){#smap #card{max-height:none}#smap .qsig{left:14px;right:14px;top:auto;bottom:18px;max-width:none}#smap header .tt{display:none}#smap header .bt{margin-left:auto}#smap.sel .qsig{display:none}#smap .cit-a span{display:none}#smap .cit-a{font-size:14px}#smap .home-a span{display:none}#smap #card .nav{position:sticky;bottom:-14px;background:rgba(7,9,19,.97);margin-top:auto;padding-bottom:calc(8px + env(safe-area-inset-bottom))}#smap .home-a{font-size:14px}#smap #card .ph img{height:110px}#smap .tt b,#smap .tt small{display:none}#smap header a{padding:7px 8px;font-size:10px;letter-spacing:.1em}}\n";
  var HTML = "<canvas id=\"c\" role=\"img\" aria-label=\"Hv\u011bzdn\u00e1 mapa miln\u00edk\u016f. Seznam je dostupn\u00fd tla\u010d\u00edtkem Seznam.\"></canvas>\n<div class=\"vig\"></div><div class=\"scan\"></div>\n<i class=\"cn a\"></i><i class=\"cn b\"></i><i class=\"cn c\"></i><i class=\"cn d\"></i>\n<header>\n  <div class=\"tt\">\u2726 Star chart \u00b7 <b>A mezit\u00edm se semlelo\u2026</b><small id=\"sub\"></small></div>\n  <div class=\"bt\"><a href=\"/\" class=\"home-a\" title=\"Hlavní stránka\">⌂<span> Hlavní stránka</span></a><a href=\"/about/\">\u2190 O Zajdovi</a><a href=\"/citaty\" class=\"cit-a\" title=\"Citáty\">✦<span> Citáty</span></a><button id=\"homeBtn\" title=\"Cel\u00e1 mapa\">\u2316 Map</button><button id=\"listBtn\">\u2261 Seznam</button></div>\n</header>\n<div id=\"boot\"><div>&gt; Acquiring star chart\u2026</div><div id=\"bootN\"></div><div>&gt; Plotting trajectory <i></i></div></div>\n<div id=\"hint\">t\u00e1hni \u00b7 p\u0159ibli\u017e \u00b7 klikni na hv\u011bzdu</div>\n<div id=\"hud\"></div>\n<a id=\"qsig\" class=\"qsig\" href=\"/citaty\"><div class=\"qs-h\">◌ Incoming signal</div><div class=\"qs-t\" id=\"qsT\"></div><div class=\"qs-a\" id=\"qsA\"></div></a>\n<div id=\"tl\" aria-label=\"\u010casov\u00e1 osa\"><div class=\"ln\"></div></div>\n<aside id=\"card\" aria-live=\"polite\">\n  <div class=\"meta\"><span class=\"dot\"></span><span id=\"cType\"></span><span id=\"cDate\" style=\"color:var(--dim)\"></span></div>\n  <h2 id=\"cTitle\"></h2>\n  <p><span id=\"pA\"></span><span id=\"pB\" style=\"visibility:hidden\"></span></p>\n  <div class=\"ph\" id=\"cPh\"></div>\n  <div class=\"tele\"><div>Class<b id=\"tCls\"></b></div><div>Distance<b id=\"tDist\"></b></div><div>Magnitude<b id=\"tMag\"></b></div></div>\n  <div class=\"sh\" id=\"cSh\"></div>\n  <a id=\"cLink\" href=\"#\">O t\u00fdhle cest\u011b v\u00edc p\u00ed\u0161u tady \u2192</a>\n  <div class=\"nav\"><button id=\"prev\">\u2190 D\u0159\u00edve</button><span id=\"cNum\"></span><button id=\"next\">Pozd\u011bji \u2192</button></div>\n</aside>";
  
function hash(s){var h=5381;s=String(s);for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h}
function clampN(v,a,b){return v<a?a:v>b?b:v}
var PAL=[[255,122,156],[184,156,255],[127,214,255],[95,240,220],[255,211,107]];
function palAt(u){var p=u*(PAL.length-1),i=Math.min(PAL.length-2,Math.floor(p)),f=p-i,a=PAL[i],b=PAL[i+1];return a.map(function(v,k){return Math.round(v+(b[k]-v)*f)})}
function yearOf(m){var t=m.date?Date.parse(m.date):NaN;if(!isFinite(t))t=m.created||Date.now();var d=new Date(t),y=d.getUTCFullYear();return y+(t-Date.UTC(y,0,1))/31557600000}
function fmtDate(m){if(!m.date)return '';try{var s=new Date(m.date).toLocaleDateString('cs-CZ',{month:'long',year:'numeric'});return s.charAt(0).toUpperCase()+s.slice(1)}catch(e){return ''}}
var CLS=['Red dwarf','Red dwarf','Main sequence','Blue giant','Yellow giant'];
function build(list){
  var M=list.filter(function(m){return m&&m.title}).map(function(m,i){
    var photos=(m.photos&&m.photos.length)?m.photos.filter(Boolean):(m.photoUrl?[m.photoUrl]:[]);
    var text=String(m.text||'');
    var s=2+(photos.length?1:0)+(m.linkedArticleId?1:0)+(text.length>250?1:0);
    return {id:m.id,title:String(m.title),text:text,photos:photos,link:m.linkedArticleId||'',d:fmtDate(m),yr:yearOf(m),s:Math.min(5,s)};
  });
  var N=M.length,wd=Math.max(1450,(N-1)*170),x0=150,y0=M[0].yr,y1=M[N-1].yr,span=Math.max(.01,Math.abs(y1-y0)),ymin=Infinity,ymax=-Infinity;
  M.forEach(function(m,i){
    var u=N>1?i/(N-1):.5,tf=clampN((m.yr-y0)/(y1-y0||1),0,1);
    m.x=x0+wd*(.6*u+.4*tf);
    m.y=480+Math.sin(i*1.25+.6)*150+((hash(m.id)%1000)/1000-.5)*140;
    var col=palAt(N>1?i/(N-1):1);m.rgb=col.join(',');m.c='rgb('+m.rgb+')';
    m.cls=CLS[m.s-1];m.now=i===N-1;
    if(m.yr<ymin)ymin=m.yr;if(m.yr>ymax)ymax=m.yr;
  });
  var gap=Math.min(150,wd/N*.6);
  for(var i=1;i<N;i++)if(M[i].x<M[i-1].x+gap)M[i].x=M[i-1].x+gap;
  if(N>1&&M[N-1].x>x0+wd){var k=wd/(M[N-1].x-x0);M.forEach(function(m){m.x=x0+(m.x-x0)*k})}
  if(N===1)M[0].x=x0+wd/2;
  var ymin2=Math.floor(ymin),ymax2=Math.max(Math.ceil(ymax),ymin2+1);
  return {M:M,wd:wd,x0:x0,x1:x0+wd,cx:x0+wd/2,ymin:ymin2,ymax:ymax2};
}

  function open(list, opts) {
    opts = opts || {};
    list = Array.isArray(list) ? list : [];
    if (!list.filter(function (m) { return m && m.title; }).length) return null;
    var root = document.getElementById('smap');
    if (!root) {
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      root = document.createElement('div'); root.id = 'smap'; root.innerHTML = HTML; document.body.appendChild(root);
    }
    root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var $ = function (s) { return root.querySelector(s); };
var L=build(list),M=L.M,N=M.length,YMIN=L.ymin,YMAX=L.ymax;
var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
function mk(s){return function(){s=(s*16807)%2147483647;return s/2147483647}}
function clamp(v,a,b){return v<a?a:v>b?b:v}
function mod(a,n){return((a%n)+n)%n}
function ease(x){return 1-Math.pow(1-x,3)}
function back(x){var c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}

// ── Plátno ──
var cv=$('#c'),ctx=cv.getContext('2d'),VW,VH,DPR,zoomHome,CX=L.cx,CY=480,mobile=false;
var cam={x:CX,y:CY,z:1},tgt=null,tgtRate=6,sel=-1,hov=-1,filter=null,lockT=1,interacted=false;
var skip=reduce||!!opts.selectId,running=true,t0=performance.now()-(skip?99000:0),T=0;
var neb=null,layers=[],dust=[],shoot=null,nextShoot=4;

function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);VW=innerWidth;VH=innerHeight;mobile=VW<=760;
  cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);
  zoomHome=Math.min(VW/(L.wd+320),VH/(mobile?900:760));
  buildNebula();
  if(sel<0){cam={x:CX,y:CY,z:zoomHome};tgt=null}else select(sel,true);
}
function buildNebula(){
  var w=Math.round(VW*1.7),h=Math.round(VH*1.7);
  neb=document.createElement('canvas');neb.width=w;neb.height=h;
  var g=neb.getContext('2d'),r=mk(11);
  var blobs=[[.27,.36,.34,'150,70,230',.05],[.74,.66,.32,'0,190,180',.04],[.58,.2,.2,'255,90,200',.035],[.16,.8,.24,'70,110,255',.04],[.88,.2,.18,'110,60,200',.03]];
  g.globalCompositeOperation='lighter';
  blobs.forEach(function(b){
    var R=b[2]*Math.min(w,h)*1.1;
    for(var i=0;i<70;i++){
      var a=r()*6.28,d=Math.pow(r(),.6)*R*.8,x=b[0]*w+Math.cos(a)*d*1.3,y=b[1]*h+Math.sin(a)*d*.8,rr=R*(.15+r()*.45);
      var gr=g.createRadialGradient(x,y,0,x,y,rr);
      gr.addColorStop(0,'rgba('+b[3]+','+b[4]*(.5+r())+')');gr.addColorStop(1,'rgba('+b[3]+',0)');
      g.fillStyle=gr;g.fillRect(x-rr,y-rr,rr*2,rr*2);
    }
  });
}
// vrstvy hvězd, prach, doprovodné hvězdy
(function(){
  var r=mk(5);
  [[230,.12,.3,.8,.15,.4],[150,.35,.4,1,.2,.5],[70,.8,.7,1.6,.35,.8]].forEach(function(c){
    var a=[];for(var i=0;i<c[0];i++)a.push({x:r(),y:r(),r:c[3]*(.4+r()*.6),a:c[4]+r()*(c[5]-c[4]),p:r()*6.28,v:.4+r()*1.4,w:r()<.18?'255,230,200':r()<.3?'190,215,255':'207,238,233'});
    layers.push({par:c[1],s:a});
  });
  for(var i=0;i<45;i++)dust.push({x:r(),y:r(),r:.6+r()*1.4,sp:.003+r()*.01,a:.06+r()*.14,p:r()*6});
})();
var sats=[],r2=mk(23);
M.forEach(function(m,i){
  var n=2+(i%2);
  for(var k=0;k<n;k++){var a=r2()*6.28+k*2,d=80+r2()*90;sats.push({i:i,x:m.x+Math.cos(a)*d,y:m.y+Math.sin(a)*d*.8,r:1+r2()*1.4,link:r2()<.85})}
});
// křivky mezi hvězdami
M.forEach(function(m,i){
  if(i===N-1)return;var b=M[i+1],mx=(m.x+b.x)/2,my=(m.y+b.y)/2+((i%2)?-55:55),p=[];
  for(var k=0;k<=48;k++){var u=k/48,v=1-u;p.push([v*v*m.x+2*v*u*mx+u*u*b.x,v*v*m.y+2*v*u*my+u*u*b.y])}
  m.pts=p;
});
M.forEach(function(m,i){m.ap=skip?1:0;m.lp=skip?1:0;m.moon=m.s>=3});
var sprites={};
function glow(rgb){
  if(sprites[rgb])return sprites[rgb];
  var c=document.createElement('canvas');c.width=c.height=128;var g=c.getContext('2d');
  var gr=g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba('+rgb+',.95)');gr.addColorStop(.18,'rgba('+rgb+',.38)');gr.addColorStop(.5,'rgba('+rgb+',.09)');gr.addColorStop(1,'rgba('+rgb+',0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);return sprites[rgb]=c;
}
function sx(x){return(x-cam.x)*cam.z+VW/2}
function sy(y){return(y-cam.y)*cam.z+VH/2}
function pr(m){return(6+3.3*m.s)*(.72+.28*Math.min(cam.z/zoomHome,3))}

// ── Vykreslení ──
function draw(dt){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.fillStyle='#05030f';ctx.fillRect(0,0,VW,VH);
  // nebula (parallax)
  var ox=-VW*.35+clamp((CX-cam.x)*cam.z*.1,-VW*.33,VW*.33),oy=-VH*.35+clamp((CY-cam.y)*cam.z*.1,-VH*.33,VH*.33);
  ctx.drawImage(neb,ox,oy,neb.width,neb.height);
  // hvězdy v pozadí
  layers.forEach(function(L){
    var shx=cam.x*cam.z*L.par,shy=cam.y*cam.z*L.par;
    for(var i=0;i<L.s.length;i++){
      var s=L.s[i],x=mod(s.x*VW-shx,VW),y=mod(s.y*VH-shy,VH);
      var a=s.a*(reduce?1:.65+.35*Math.sin(T*s.v+s.p));
      ctx.fillStyle='rgba('+s.w+','+a+')';ctx.beginPath();ctx.arc(x,y,s.r,0,6.283);ctx.fill();
    }
  });
  // prach
  dust.forEach(function(d){
    var x=mod(d.x*VW-cam.x*cam.z*.6+(reduce?0:T*d.sp*VW),VW),y=mod(d.y*VH-cam.y*cam.z*.6,VH);
    ctx.fillStyle='rgba(180,230,225,'+d.a+')';ctx.beginPath();ctx.arc(x,y,d.r,0,6.283);ctx.fill();
  });
  // padající hvězda
  if(!reduce){
    if(!shoot&&T>nextShoot){var a=.35+Math.random()*.4;shoot={x:Math.random()*VW*.8,y:Math.random()*VH*.35,a:a,t:0};nextShoot=T+7+Math.random()*8}
    if(shoot){shoot.t+=dt;var k=shoot.t/.8;if(k>=1)shoot=null;else{
      var L=190,px=shoot.x+Math.cos(shoot.a)*k*520,py=shoot.y+Math.sin(shoot.a)*k*520;
      var gr=ctx.createLinearGradient(px,py,px-Math.cos(shoot.a)*L,py-Math.sin(shoot.a)*L);
      gr.addColorStop(0,'rgba(255,255,255,'+(.9*(1-k))+')');gr.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=gr;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(shoot.a)*L,py-Math.sin(shoot.a)*L);ctx.stroke()}}
  }
  // skenovací paprsek při startu
  if(!reduce&&T<2.2){
    var bx=VW*ease(clamp(T/2,0,1)),gr2=ctx.createLinearGradient(bx-140,0,bx,0);
    gr2.addColorStop(0,'rgba(95,240,220,0)');gr2.addColorStop(1,'rgba(95,240,220,'+(.18*(1-T/2.2))+')');
    ctx.fillStyle=gr2;ctx.fillRect(bx-140,0,140,VH);
  }
  ctx.globalCompositeOperation='lighter';
  // doprovodné hvězdy a slabé linky (souhvězdí)
  var ap0=0;
  sats.forEach(function(s,k){
    var m=M[s.i],a=ease(clamp(m.ap,0,1))*.6;if(a<=0)return;
    var x=sx(s.x),y=sy(s.y),mx=sx(m.x),my=sy(m.y);
    if(s.link){ctx.strokeStyle='rgba('+m.rgb+','+(a*.22)+')';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(x,y);ctx.stroke()}
    ctx.fillStyle='rgba(235,245,245,'+a+')';ctx.beginPath();ctx.arc(x,y,s.r*(.8+.2*Math.min(cam.z/zoomHome,3)),0,6.283);ctx.fill();
  });
  // hlavní trasa
  for(var i=0;i<N-1;i++){
    var m=M[i],b=M[i+1],p=m.lp;if(p<=0)continue;
    var cnt=Math.max(2,Math.floor(p*48)+1),pts=m.pts;
    var gr3=ctx.createLinearGradient(sx(m.x),sy(m.y),sx(b.x),sy(b.y));
    gr3.addColorStop(0,'rgba('+m.rgb+',1)');gr3.addColorStop(1,'rgba('+b.rgb+',1)');
    ctx.beginPath();for(var k=0;k<cnt&&k<pts.length;k++){var X=sx(pts[k][0]),Y=sy(pts[k][1]);k?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}
    ctx.strokeStyle=gr3;ctx.globalAlpha=.1;ctx.lineWidth=7;ctx.lineCap='round';ctx.stroke();
    ctx.globalAlpha=.65;ctx.lineWidth=1.3;ctx.stroke();ctx.globalAlpha=1;
    // světelný puls putující k nejnovější hvězdě
    if(p>=1&&!reduce){
      for(var q=0;q<2;q++){var u=mod(T*.22+i*.31+q*.5,1),pp=pts[Math.floor(u*48)];
        var px=sx(pp[0]),py=sy(pp[1]),pg=glow(m.rgb);
        ctx.globalAlpha=.9*Math.sin(u*3.14159);ctx.drawImage(pg,px-9,py-9,18,18);
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,1.3,0,6.283);ctx.fill();}
      ctx.globalAlpha=1;
    }
  }
  // hvězdy
  var order=[],i;for(i=0;i<N;i++)order.push(i);
  order.sort(function(a,b){return M[a].s-M[b].s});
  var labels=[];
  order.forEach(function(i){
    var m=M[i],ap=clamp(m.ap,0,1);if(ap<=0)return;
    var x=sx(m.x),y=sy(m.y);if(x<-150||x>VW+150||y<-150||y>VH+150)return;
    var dim=1,sc=reduce?1:back(ap),r=pr(m)*sc,c=m,hot=(i===sel||i===hov),tw=reduce?1:1+.08*Math.sin(T*2.1+i*1.7);
    ctx.globalAlpha=dim*Math.min(1,ap*2);
    var gs=r*(hot?4.2:3.5)*tw;ctx.drawImage(glow(c.rgb),x-gs,y-gs,gs*2,gs*2);
    // difrakční paprsky
    var len=r*(hot?3.1:2.5)*tw,lw=1.3;
    function spike(x1,y1,x2,y2,al){var g=ctx.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,'+al+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.strokeStyle=g;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
    spike(x-len,y,x+len,y,.9);spike(x,y-len,x,y+len,.9);
    if(m.s>=3){var d=len*.62,ro=reduce?0:Math.sin(T*.5+i)*.12,cs=Math.cos(.785+ro),sn=Math.sin(.785+ro);spike(x-cs*d,y-sn*d,x+cs*d,y+sn*d,.45);spike(x+sn*d,y-cs*d,x-sn*d,y+cs*d,.45)}
    ctx.fillStyle='rgba('+c.rgb+',.9)';ctx.beginPath();ctx.arc(x,y,r*.46,0,6.283);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,r*.27,0,6.283);ctx.fill();
    // měsíček na oběžné dráze
    if(m.moon&&ap>=1){
      var oa=T*(.5+m.s*.07)+i*2.3,orr=r*2.15;
      ctx.strokeStyle='rgba('+c.rgb+',.13)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,orr,orr*.42,-.4,0,6.283);ctx.stroke();
      var ex=Math.cos(oa)*orr,ey=Math.sin(oa)*orr*.42,rx=ex*Math.cos(-.4)-ey*Math.sin(-.4),ry=ex*Math.sin(-.4)+ey*Math.cos(-.4);
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(x+rx,y+ry,1.9,0,6.283);ctx.fill();
    }
    // pulzující kruhy „teď"
    if(m.now&&!reduce){
      for(var q=0;q<3;q++){var u=mod(T*.45+q/3,1);ctx.strokeStyle='rgba('+c.rgb+','+(.55*(1-u))+')';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,r*(1+u*3.4),0,6.283);ctx.stroke()}
    }
    ctx.globalAlpha=1;
    labels.push({i:i,x:x,y:y,r:r,dim:dim});
  });
  ctx.globalCompositeOperation='source-over';
  // zaměřovač na vybrané hvězdě
  if(sel>=0&&M[sel].ap>=1){
    var m2=M[sel],x2=sx(m2.x),y2=sy(m2.y),rr=pr(m2),k2=ease(clamp(lockT,0,1)),R=rr*(2.7+(1-k2)*2.5);
    ctx.save();ctx.translate(x2,y2);
    ctx.strokeStyle='rgba('+m2.rgb+','+(.35+.5*k2)+')';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.rotate(reduce?0:T*.5);
    ctx.beginPath();ctx.arc(0,0,R,0,6.283);ctx.stroke();ctx.setLineDash([]);ctx.rotate(reduce?0:-T*.5);
    ctx.strokeStyle='rgba(255,255,255,'+(.8*k2)+')';ctx.lineWidth=1.3;
    var B=R*1.28,Lb=Math.min(11,R*.35);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(q){ctx.beginPath();ctx.moveTo(q[0]*B,q[1]*(B-Lb));ctx.lineTo(q[0]*B,q[1]*B);ctx.lineTo(q[0]*(B-Lb),q[1]*B);ctx.stroke()});
    ctx.restore();
    ctx.font='600 9.5px Space Grotesk,system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,'+(.75*k2)+')';ctx.textAlign='left';
    ctx.fillText('TARGET LOCKED',x2+B+6,y2-B+8);ctx.fillStyle='rgba('+m2.rgb+','+(.8*k2)+')';ctx.fillText('OBJ-'+('0'+(sel+1)).slice(-2),x2+B+6,y2-B+21);
  }
  // popisky bez kolizí
  ctx.font='600 11px Space Grotesk,system-ui,sans-serif';ctx.textAlign='center';
  var rects=[];
  labels.sort(function(a,b){return(b.i===sel)-(a.i===sel)||(b.i===hov)-(a.i===hov)||M[b.i].s-M[a.i].s});
  labels.forEach(function(L){
    var m=M[L.i],txt=m.title.length>26?m.title.slice(0,25)+'…':m.title;
    if(mobile&&cam.z<zoomHome*1.5&&L.i!==sel)return;
    var w=ctx.measureText(txt).width+10,ly=L.y+L.r*2.1+(L.i===sel?L.r*.9:0),rc={x:L.x-w/2,y:ly-4,w:w,h:34};
    for(var k=0;k<rects.length;k++){var o=rects[k];if(rc.x<o.x+o.w&&rc.x+rc.w>o.x&&rc.y<o.y+o.h&&rc.y+rc.h>o.y)return}
    rects.push(rc);
    var hot=(L.i===sel||L.i===hov),a=(hot?1:.72)*L.dim*Math.min(1,m.ap*2);
    ctx.fillStyle='rgba('+(hot?'255,255,255':'170,200,198')+','+a+')';ctx.fillText(txt,L.x,ly+8);
    ctx.font='10px Space Grotesk,system-ui,sans-serif';ctx.fillStyle='rgba(95,130,128,'+a+')';ctx.fillText(m.d,L.x,ly+22);ctx.font='600 11px Space Grotesk,system-ui,sans-serif';
  });
}

// ── Kamera a smyčka ──
var frame=0,last=performance.now(),hud=$('#hud');
function loop(now){if(!running)return;
  var dt=Math.min(.05,(now-last)/1000);last=now;T=(now-t0)/1000;
  M.forEach(function(m,i){if(!skip){m.ap=clamp((T-(.5+.28*i))/.7,0,1);m.lp=clamp((T-(.62+.28*i))/.45,0,1)}});
  if(tgt){var k=1-Math.exp(-dt*tgtRate);cam.x+=(tgt.x-cam.x)*k;cam.y+=(tgt.y-cam.y)*k;cam.z+=(tgt.z-cam.z)*k;
    if(Math.abs(tgt.x-cam.x)+Math.abs(tgt.y-cam.y)<.3&&Math.abs(tgt.z-cam.z)<.002)tgt=null}
  if(lockT<1)lockT+=dt/.45;
  draw(dt);
  if(++frame%8===0){
    var ra=mod(cam.x/(L.wd+300)*24,24),dec=(.5-cam.y/960)*90;
    hud.innerHTML='RA '+('0'+Math.floor(ra)).slice(-2)+'h '+('0'+Math.floor((ra%1)*60)).slice(-2)+'m<br>DEC '+(dec>=0?'+':'−')+Math.abs(dec).toFixed(1)+'°<br>ZOOM ×'+(cam.z/zoomHome).toFixed(2);
  }
  requestAnimationFrame(loop);
}

// ── Výběr / navigace ──
var card=$('#card'),tm=null;
function fly(x,y,z,rate){tgtRate=rate||5;var t={x:x,y:y,z:z};if(reduce){cam.x=x;cam.y=y;cam.z=z;tgt=null}else tgt=t}
function typeInto(txt){
  clearInterval(tm);var a=$('#pA'),b=$('#pB');
  if(reduce){a.textContent=txt;b.textContent='';return}
  var i=0;a.textContent='';b.textContent=txt;
  var stp=Math.max(2,Math.ceil(txt.length/220));tm=setInterval(function(){i+=stp;a.textContent=txt.slice(0,i);b.textContent=txt.slice(i);if(i>=txt.length)clearInterval(tm)},16);
}
function fitCard(){
    var p=card.querySelector('p'),ph=$('#cPh'),lim=mobile?VH*.66+1:VH-150,fs=mobile?16:(innerWidth*.0135<17?17:Math.min(20,innerWidth*.0135));
    p.style.fontSize='';ph.style.display='';ph.querySelectorAll('img').forEach(function(im){im.style.height=''});
    while(card.scrollHeight>lim&&fs>(mobile?13:14.5)){fs-=.5;p.style.fontSize=fs+'px'}
    if(card.scrollHeight>lim&&ph.children.length){
      var imgs=ph.querySelectorAll('img'),hh=imgs[0]?imgs[0].getBoundingClientRect().height||110:110;
      while(card.scrollHeight>lim&&hh>64){hh-=6;for(var k=0;k<imgs.length;k++)imgs[k].style.height=hh+'px'}
    }
    while(card.scrollHeight>lim&&fs>12.5){fs-=.5;p.style.fontSize=fs+'px'}
    var te=card.querySelector('.tele');te.style.display='';if(card.scrollHeight>lim)te.style.display='none';card.style.overflowY='auto';
  }
function select(i,keep){root.classList.add('sel');
  sel=i;var m=M[i],z=mobile?Math.max(zoomHome*2.2,1.05):Math.max(zoomHome*1.45,.85);if(!keep)lockT=0;
  var cx=m.x,cy=m.y;
  if(mobile)cy=m.y+(VH*.5-VH*.235)/z;else cx=m.x-(VW*.30-VW/2)/z;
  fly(cx,cy,z,keep?20:4.5);
  var c=m;card.style.setProperty('--cc',c.c);
  $('#cType').textContent='OBJ-'+('0'+(i+1)).slice(-2);$('#cType').style.color=c.c;
  var dot=card.querySelector('.dot');dot.style.background=c.c;dot.style.boxShadow='0 0 10px '+c.c;
  $('#cDate').textContent=m.d;$('#cTitle').textContent=m.title;
  $('#tCls').textContent=c.cls;
  $('#tDist').textContent=m.now?'Latest signal':(m.yr-M[0].yr).toFixed(1)+' ly';
  $('#tMag').textContent=new Array(m.s+1).join('●')+new Array(6-m.s).join('○');
  var lk=$('#cLink');lk.style.display=m.link?'':'none';if(m.link)lk.href='/article?id='+encodeURIComponent(m.link);
  var ph=$('#cPh');ph.innerHTML='';m.photos.slice(0,3).forEach(function(u){var im=document.createElement('img');im.src=u;im.alt='';im.decoding='async';im.onclick=function(){if(window.openLightbox)window.openLightbox(u)};ph.appendChild(im)});
  var sh=$('#cSh');sh.innerHTML='';
  var surl=location.origin+'/timeline/?m='+encodeURIComponent(m.id)+'#milestone-'+encodeURIComponent(m.id),stxt=m.title+' — Moje diagnóza, můj vesmír';
  function mkb(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=function(){fn(b)};sh.appendChild(b);return b}
  mkb('⤢ Celé',function(){openFull(i)});
  if(navigator.share)mkb('📤 Sdílet',function(b){if(window.shareMilestone)window.shareMilestone(stxt,surl,b)});
  else{var wa=document.createElement('a');wa.href='https://wa.me/?text='+encodeURIComponent(stxt+' '+surl);wa.target='_blank';wa.rel='noopener';wa.textContent='WhatsApp';sh.appendChild(wa)}
  mkb('🔗 Odkaz',function(b){if(window.copyMilestoneLink)window.copyMilestoneLink(b,surl)});
  try{if(location.pathname.indexOf('/timeline')===0)history.replaceState(null,'','/timeline/?m='+encodeURIComponent(m.id))}catch(e){}
  $('#cNum').textContent=(i+1)+' / '+N;
  $('#prev').disabled=i===0;$('#next').disabled=i===N-1;
  card.classList.add('on');
  fitCard();
  if(!keep)typeInto(m.text);fitCard();
  var tl=document.querySelectorAll('#tl button');for(var k=0;k<tl.length;k++)tl[k].classList.toggle('sel',k===i);
  hideHint();
}

/* ── Milník na celou obrazovku: fotky se přejíždějí prstem, text se dá číst bez omezení výškou karty ── */
var fullEl=null;
function closeFull(){if(fullEl){fullEl.remove();fullEl=null;document.documentElement.style.overflow=''}}
function openFull(i){
  closeFull();
  var m=M[i];if(!m)return;
  var ov=document.createElement('div');fullEl=ov;
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  ov.style.cssText='position:fixed;inset:0;z-index:200;background:#05030f;color:#cfeee9;display:flex;flex-direction:column;font-family:Space Grotesk,system-ui,sans-serif';
  var ph=(m.photos||[]).slice(0,6);
  var h='<div style="flex:none;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top))">'+
    '<span style="font:600 12px var(--mono,inherit);letter-spacing:.14em;text-transform:uppercase;color:#7f9a98">'+(i+1)+' / '+N+'</span>'+
    '<button type="button" data-x aria-label="Zavřít" style="all:unset;cursor:pointer;font-size:22px;min-width:44px;min-height:44px;text-align:center;line-height:44px">✕</button></div>';
  h+='<div style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch">';
  if(ph.length){
    h+='<div data-pg style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;height:min(62vh,640px)">'+
      ph.map(function(u){return '<div style="flex:none;width:100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;padding:0 8px;box-sizing:border-box"><img src="'+u.replace(/"/g,'&quot;')+'" alt="" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px"></div>'}).join('')+'</div>';
    if(ph.length>1)h+='<div data-dots style="display:flex;gap:6px;justify-content:center;padding:10px 0">'+ph.map(function(_,k){return '<i style="width:7px;height:7px;border-radius:50%;background:'+(k?'#35504f':'#5ff0dc')+'"></i>'}).join('')+'</div>';
  }
  var title=document.createElement('div');title.textContent=m.title||'';
  var txt=document.createElement('div');txt.textContent=m.text||'';
  h+='<div style="max-width:720px;margin:0 auto;padding:12px 20px 24px"><div style="font:600 12px var(--mono,inherit);letter-spacing:.16em;color:#7f9a98;margin-bottom:6px">'+(m.d||'').replace(/</g,'&lt;')+'</div>'+
    '<h2 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#fff">'+title.innerHTML+'</h2>'+
    '<div style="font-size:17px;line-height:1.7;color:#b9d0ce;white-space:pre-wrap">'+txt.innerHTML+'</div>'+
    (m.link?'<a href="/article?id='+encodeURIComponent(m.link)+'" style="display:inline-block;margin-top:16px;color:#f2b8ff;font-size:16px;text-decoration:none">O týhle cestě víc píšu tady →</a>':'')+'</div></div>';
  h+='<div style="flex:none;display:flex;gap:10px;padding:10px 14px;padding-bottom:calc(10px + env(safe-area-inset-bottom));border-top:1px solid #1f3234">'+
    '<button type="button" data-p '+(i===0?'disabled':'')+' style="flex:1;min-height:46px;border:1px solid #2b3a3a;background:none;color:#cfeee9;border-radius:6px;font:600 14px inherit;opacity:'+(i===0?.35:1)+'">← Dříve</button>'+
    '<button type="button" data-n '+(i===N-1?'disabled':'')+' style="flex:1;min-height:46px;border:1px solid #2b3a3a;background:none;color:#cfeee9;border-radius:6px;font:600 14px inherit;opacity:'+(i===N-1?.35:1)+'">Později →</button></div>';
  ov.innerHTML=h;
  document.body.appendChild(ov);document.documentElement.style.overflow='hidden';
  ov.querySelector('[data-x]').onclick=closeFull;
  var pb=ov.querySelector('[data-p]'),nb=ov.querySelector('[data-n]');
  pb.onclick=function(){if(i>0){select(i-1);openFull(i-1)}};
  nb.onclick=function(){if(i<N-1){select(i+1);openFull(i+1)}};
  var pg=ov.querySelector('[data-pg]'),dots=ov.querySelectorAll('[data-dots] i');
  if(pg&&dots.length)pg.addEventListener('scroll',function(){var k=Math.round(pg.scrollLeft/pg.clientWidth);for(var d=0;d<dots.length;d++)dots[d].style.background=d===k?'#5ff0dc':'#35504f'},{passive:true});
  ov.addEventListener('keydown',function(e){if(e.key==='Escape')closeFull()});
  ov.tabIndex=-1;ov.focus();
}
function home(){root.classList.remove('sel');
  sel=-1;card.classList.remove('on');clearInterval(tm);
  var tl=document.querySelectorAll('#tl button');for(var k=0;k<tl.length;k++)tl[k].classList.remove('sel');
  fly(CX,CY,zoomHome,3.5);
  try{if(location.pathname.indexOf('/timeline')===0)history.replaceState(null,'','/timeline/')}catch(e){}
}
function hideHint(){interacted=true;$('#hint').style.opacity=0}

// ── Ovládání ──
var ptrs={},drag=null,moved=false,pinch=0;
function zoomAt(px,py,f){
  var wx=(px-VW/2)/cam.z+cam.x,wy=(py-VH/2)/cam.z+cam.y;
  cam.z=clamp(cam.z*f,zoomHome*.75,zoomHome*9);cam.x=wx-(px-VW/2)/cam.z;cam.y=wy-(py-VH/2)/cam.z;tgt=null;
}
function pick(px,py){
  var best=-1,bd=1e9;
  for(var i=0;i<N;i++){var m=M[i];if(m.ap<.6)continue;var d=Math.hypot(sx(m.x)-px,sy(m.y)-py);if(d<Math.max(26,pr(m)*1.8)&&d<bd){bd=d;best=i}}
  return best;
}
cv.addEventListener('pointerdown',function(e){
  cv.setPointerCapture(e.pointerId);ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  var ids=Object.keys(ptrs);
  if(ids.length===1){drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y};moved=false}
  else if(ids.length===2){var a=ptrs[ids[0]],b=ptrs[ids[1]];pinch=Math.hypot(a.x-b.x,a.y-b.y);moved=true}
});
cv.addEventListener('pointermove',function(e){
  var p=ptrs[e.pointerId];
  if(!p){if(e.pointerType==='mouse'){var h=pick(e.clientX,e.clientY);if(h!==hov){hov=h;cv.style.cursor=h>=0?'pointer':'grab'}}return}
  p.x=e.clientX;p.y=e.clientY;var ids=Object.keys(ptrs);
  if(ids.length===2){
    var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinch>0)zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/pinch);pinch=d;hideHint();return;
  }
  if(!drag)return;
  var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!moved&&Math.hypot(dx,dy)<7)return;
  if(!moved){moved=true;cv.style.cursor='grabbing';tgt=null;hideHint()}
  cam.x=drag.cx-dx/cam.z;cam.y=drag.cy-dy/cam.z;
  cam.x=clamp(cam.x,L.x0-500,L.x1+500);cam.y=clamp(cam.y,-250,1250);
});
function up(e){
  var was=ptrs[e.pointerId];delete ptrs[e.pointerId];pinch=0;
  if(Object.keys(ptrs).length===1){var id=Object.keys(ptrs)[0];drag={x:ptrs[id].x,y:ptrs[id].y,cx:cam.x,cy:cam.y};moved=true}
  if(Object.keys(ptrs).length===0){
    cv.style.cursor=hov>=0?'pointer':'grab';
    if(!moved&&was&&e.type==='pointerup'){var h=pick(e.clientX,e.clientY);if(h>=0)select(h);else if(sel>=0)home()}
    drag=null;
  }
}
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',function(e){e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0016));hideHint()},{passive:false});
addEventListener('keydown',function(e){if(!running)return;
  if(e.key==='ArrowRight'||e.key==='ArrowDown'){select(sel<0?0:Math.min(sel+1,N-1))}
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){if(sel>0)select(sel-1)}
  else if(e.key==='Escape'){home()}
});
$('#prev').onclick=function(){if(sel>0)select(sel-1)};
$('#next').onclick=function(){if(sel<N-1)select(sel+1)};
$('#homeBtn').onclick=home;
$('#listBtn').onclick=function(){if(opts.onList)opts.onList()};

// ── Časová osa ──
var tl=$('#tl');
var ystep=(YMAX-YMIN)>12?2:1;for(var y=YMIN;y<=YMAX;y+=ystep){var tk=document.createElement('div');tk.className='tk';tk.style.left='calc(8px + (100% - 16px) * '+((y-YMIN)/(YMAX-YMIN))+')';tk.innerHTML='<span>'+(y%1?'':y)+'</span>';tl.appendChild(tk)}
M.forEach(function(m,i){
  var b=document.createElement('button');b.style.left='calc(8px + (100% - 16px) * '+((m.yr-YMIN)/(YMAX-YMIN))+')';b.style.color=m.c;
  b.setAttribute('aria-label',m.d+': '+m.title);b.title=m.d+' — '+m.title;b.onclick=function(){select(i)};tl.appendChild(b);
});

// ── Start ──
// ── Citáty jako příchozí signály ──
(function(){
  var box=$('#qsig'),tx=$('#qsT'),au=$('#qsA');if(!box)return;
  function qid(t){var h=5381;t=String(t).trim();for(var i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return (h>>>0).toString(36)}
  fetch('/api/quotes/list').then(function(r){return r.ok?r.json():[]}).then(function(a){
    var q=(Array.isArray(a)?a:[]).filter(function(x){return x&&x.text&&String(x.text).length<=220});
    if(!q.length)return;
    for(var i=q.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=q[i];q[i]=q[j];q[j]=t}
    var k=0;
    function show(){
      if(!running||document.hidden){setTimeout(show,2000);return}
      var x=q[k++%q.length],full='\u201E'+String(x.text).trim()+'\u201C';
      box.href='/citaty?q='+qid(x.text);
      au.textContent=x.author?'\u2014 '+x.author:'';
      tx.textContent='';box.classList.add('on');
      var step=reduce?full.length:1,pos=0,iv=setInterval(function(){pos+=step;tx.textContent=full.slice(0,pos);if(pos>=full.length)clearInterval(iv)},reduce?0:28);
      var typed=reduce?0:full.length*28;
      setTimeout(function(){box.classList.remove('on');setTimeout(show,3200)},typed+6000+full.length*35);
    }
    setTimeout(show,2500);
  }).catch(function(){});
})();
addEventListener('resize',resize);
resize();
$('#sub').textContent='Deep-space survey · '+N+' objects catalogued';
$('#bootN').textContent='> '+N+' objects catalogued';
if(skip){var bt=$('#boot');if(bt)bt.remove()}
if(!skip){cam={x:M[0].x+120,y:M[0].y-60,z:zoomHome*2.4};fly(CX,CY,zoomHome,1.6);setTimeout(function(){if(!interacted)$('#hint').style.opacity=1},3600)}
else $('#hint').style.opacity=1;
var si=-1;if(opts.selectId){for(var q=0;q<N;q++)if(String(M[q].id)===String(opts.selectId))si=q}
if(si>=0)select(si);
requestAnimationFrame(loop);
return {
  show:function(){root.hidden=false;document.documentElement.style.overflow='hidden';if(!running){running=true;last=performance.now();requestAnimationFrame(loop)}},
  hide:function(){running=false;root.hidden=true;document.documentElement.style.overflow=''}
};

  }
  window.StarMap = { open: open };
})();
