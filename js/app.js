/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO  —  é só aqui que você mexe
   ════════════════════════════════════════════════════════════ */

// Ano que aparece antes do vídeo da irmã (é só trocar o número):
const VIDEO_ANO = '2022';

// Apps Script do RSVP (lista de convidados) — já existente:
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxk-OrRRvee1H2rgXB0UVXrSll7yWK-Sd3H8xm49SwMOU8NQgYUHHkDjWPYjBn8fAwquw/exec';

// Apps Script dos PRESENTES (planilha do formulário):
const PRODUTOS_URL = 'https://script.google.com/macros/s/AKfycbw47uIHThSgKbcoOyXUYWXruGTIquVkDWgjWmw_0i160Mi-3SB-hxhs-KmKEizKUMk72Q/exec';

/* ════════════════════════════════════════════════════════════
   PRESENTES DE EXEMPLO (aparecem só enquanto PRODUTOS_URL está vazio)
   ════════════════════════════════════════════════════════════ */
// Exemplos de Cama & Banho (aparecem enquanto a planilha estiver vazia — servem para testar o fluxo)
const PRODUTOS_EXEMPLO = [
  { id:'e1', nome:'Jogo de toalhas de banho e rosto', preco:'149,90', img:'', loja:'Buddemeyer', link:'https://www.buddemeyer.com.br', spec:'Jogo de toalhas 100% algodão, macias e de alta absorção. (Exemplo para testar — os presentes de verdade virão da planilha.)' },
  { id:'e2', nome:'Edredom casal dupla face', preco:'189,99', img:'', loja:'Casa Riachuelo', link:'https://www.riachuelo.com.br', spec:'Edredom casal reversível, quentinho e leve. (Exemplo para testar — os presentes de verdade virão da planilha.)' },
  { id:'e3', nome:'Jogo de lençóis 4 peças 200 fios', preco:'159,90', img:'', loja:'MMartan', link:'https://www.mmartan.com.br', spec:'Jogo de lençóis em algodão 200 fios, toque macio. (Exemplo para testar.)' },
  { id:'e4', nome:'Kit 2 travesseiros de conforto', preco:'99,90', img:'', loja:'Magalu', link:'https://www.magazineluiza.com.br', spec:'Par de travesseiros com suporte ideal para noites tranquilas. (Exemplo para testar.)' },
];

/* ════════════════════════════════════════════════════════════
   ESTADO
   ════════════════════════════════════════════════════════════ */
function load(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }
function save(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }

let PRODUCTS   = [];                               // preenchido pelo servidor ou pelos exemplos
let wishlist   = load('mr_wishlist', []);          // corações (por aparelho)
let localReserved = load('mr_localReserved', {});  // reservas locais (modo exemplo)
let pendingGift = null;                            // presente que foi p/ a loja aguardando confirmação
let usingExamples = false;                          // true quando a planilha está vazia e mostramos os exemplos
const guestToken = (function(){ let t=load('mr_guest',null); if(!t){ t='g'+Math.random().toString(36).slice(2,10); save('mr_guest',t); } return t; })();
const SERVER_ON = !!PRODUTOS_URL;
function localMode(){ return !SERVER_ON || usingExamples; }  // reservas ficam locais nesse modo

const $ = s => document.querySelector(s);
const productById = id => PRODUCTS.find(p => p.id === id);

/* reservado? por quem? */
function reservedBy(p){ return localMode() ? (localReserved[p.id] || '') : (p.reservado || ''); }
function isMine(p){ return reservedBy(p) === guestToken; }
function isTaken(p){ const r = reservedBy(p); return r && r !== guestToken; }
function myGift(){ return PRODUCTS.find(p => isMine(p)) || null; }
function myGifts(){ return PRODUCTS.filter(p => isMine(p)); }

/* preço bonitinho */
function money(v){ if(v==null) return ''; v=String(v).trim(); if(!v) return ''; return v.startsWith('R$')?v:('R$ '+v); }

/* ════════════════════════════════════════════════════════════
   BUSCAR PRODUTOS
   ════════════════════════════════════════════════════════════ */
async function loadProducts(){
  if (!SERVER_ON){ PRODUCTS = PRODUTOS_EXEMPLO.map(p=>({...p})); usingExamples=true; return; }
  try {
    const res = await fetch(PRODUTOS_URL + '?t=' + Date.now());
    const data = await res.json();
    const lista = (Array.isArray(data)?data:(data.produtos||[]));
    if (!lista.length){ PRODUCTS = PRODUTOS_EXEMPLO.map(p=>({...p})); usingExamples=true; return; } // planilha vazia -> mostra exemplos p/ testar
    usingExamples=false;
    PRODUCTS = lista.map(p => ({
      id: String(p.id),
      nome: p.nome || p.titulo || 'Presente',
      loja: p.loja || '',
      link: p.link || '#',
      preco: p.preco || '',
      img: p.img || p.imagem || '',
      spec: p.spec || p.descricao || '',
      reservado: p.reservado || ''
    }));
  } catch(e){
    console.warn('Falha ao buscar presentes, usando exemplos.', e);
    PRODUCTS = PRODUTOS_EXEMPLO.map(p=>({...p})); usingExamples=true;
  }
}

/* ════════════════════════════════════════════════════════════
   HELPERS DE HTML
   ════════════════════════════════════════════════════════════ */
function phSVG(){ return '<div class="gift-ph"><svg viewBox="0 0 24 24" fill="none"><path d="M20 12v9H4v-9M2 7h20v5H2V7zM12 22V7M12 7S9 2 6.5 2 4 5 4 5s1 2 4 2M12 7s3-5 5.5-5S20 5 20 5s-1 2-4 2" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg><span>foto em breve</span></div>'; }
function mediaHTML(p){ return p.img ? `<img src="${p.img}" alt="${p.nome}" loading="lazy" onerror="this.parentNode.innerHTML='${phSVG().replace(/'/g,"\\'")}'">` : phSVG(); }
function heartSVG(){ return `<svg viewBox="0 0 24 24"><path class="houtline" d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.9A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/></svg>`; }

/* ════════════════════════════════════════════════════════════
   ROTEADOR (menu / páginas)
   ════════════════════════════════════════════════════════════ */
function go(route){ location.hash = route ? '#/'+route : '#/'; if(window.innerWidth<=780) closeMenu(); window.scrollTo(0,0); }
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $('#view-'+name).classList.add('active');
  const rota = (name==='home'?'':(name==='produto'?'presentes':name));
  document.querySelectorAll('.nav-link[data-route]').forEach(l=>{
    l.classList.toggle('active', l.dataset.route === rota);
  });
  document.querySelectorAll('.ntab[data-route],.tabbar-item[data-route]').forEach(l=>{
    l.classList.toggle('active', l.dataset.route === rota);
  });
}
async function router(){
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('produto/')) { showView('produto'); if(!PRODUCTS.length) await loadProducts(); renderProduct(h.split('/')[1]); }
  else if (h === 'presentes') { showView('presentes'); await ensureProductsAndRenderGrid(); }
  else if (h === 'progresso') { showView('progresso'); if(!PRODUCTS.length) await loadProducts(); renderProgress(); }
  else { showView('home'); }
}
window.addEventListener('hashchange', router);

async function ensureProductsAndRenderGrid(){
  const grid = $('#giftGrid');
  grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-faint);padding:60px 0;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;">carregando presentes…</p>`;
  await loadProducts();
  renderGrid();
  updateBadges();
}

/* ════════════════════════════════════════════════════════════
   GRADE DE PRESENTES
   ════════════════════════════════════════════════════════════ */
function renderGrid(){
  const grid = $('#giftGrid');
  if (!PRODUCTS.length){ grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-faint);padding:60px 0;">A lista de presentes chega em breve 💕</p>`; return; }
  grid.innerHTML = PRODUCTS.map(p=>{
    const liked = wishlist.includes(p.id);
    const mine = isMine(p), taken = isTaken(p);
    let flag = '';
    if (mine)  flag = `<div class="gift-reserved-flag"><span class="rf-ico">🎁</span><span class="rf-txt">Você escolheu 💕</span><span class="rf-sub">está na sua sacola</span></div>`;
    else if (taken) flag = `<div class="gift-reserved-flag"><span class="rf-ico">🎀</span><span class="rf-txt">Já reservado</span><span class="rf-sub">por outro convidado</span></div>`;
    return `<article class="gift-card" data-id="${p.id}" onclick="openProduct('${p.id}')">
      <div class="gift-media">
        ${mediaHTML(p)}
        <button class="gift-like ${liked?'liked':''}" onclick="event.stopPropagation();toggleLike('${p.id}',this)" aria-label="Curtir">${heartSVG()}</button>
        ${flag}
      </div>
      <div class="gift-body">
        <p class="gift-name">${p.nome}</p>
        <p class="gift-price">${money(p.preco)}</p>
        <p class="gift-store">${p.loja}</p>
      </div>
    </article>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   PÁGINA DO PRODUTO
   ════════════════════════════════════════════════════════════ */
function openProduct(id){ go('produto/'+id); }
function renderProduct(id){
  const p = productById(id);
  if (!p){ go('presentes'); return; }
  const liked = wishlist.includes(id), mine = isMine(p), taken = isTaken(p);
  $('#prodWrap').innerHTML = `
    <button class="prod-back" onclick="go('presentes')">← Voltar para os presentes</button>
    <div class="prod-grid">
      <div class="prod-media">
        ${mediaHTML(p)}
        <button class="prod-like ${liked?'liked':''}" onclick="toggleLike('${p.id}',this)" aria-label="Curtir">${heartSVG()}</button>
      </div>
      <div class="prod-info">
        <h1 class="prod-name">${p.nome}</h1>
        <p class="prod-price">${money(p.preco)}</p>
        <p class="prod-price-note">valor de referência · pode variar por loja</p>
        ${p.spec?`<p class="prod-spec-lbl">Especificação</p><p class="prod-spec">${p.spec}</p>`:''}
        ${p.loja?`<div class="prod-store-chip"><span class="dot"></span> Sugestão: ${p.loja}</div>`:''}
        ${ mine
          ? `<div class="prod-tip" style="background:var(--pink-pale);border:1px solid var(--pink-soft);"><b>Este é o presente que você escolheu 💕</b><br>Ele está guardado na sua sacola.</div>
             <button class="prod-cancel" onclick="cancelGift('${p.id}')">Cancelar presente</button>`
          : taken
          ? `<div class="prod-tip"><b>Presente já reservado</b> por outro convidado.<br>Que tal escolher outro? 💕</div>`
          : `<button class="prod-buy" onclick="startBuy('${p.id}')">
               <svg viewBox="0 0 24 24" fill="none"><path d="M6 8h12l-1 12H7L6 8z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
               Comprar na loja
             </button>
             <div class="prod-tip">Você pode comprar este item <b>na loja que preferir</b>. Vale buscar cupons e promoções — e usar o <b>Méliuz</b> para ganhar cashback. 💰</div>` }
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════
   CURTIR (lista de desejos) + coração animado
   ════════════════════════════════════════════════════════════ */
function toggleLike(id, btn){
  const i = wishlist.indexOf(id);
  if (i>=0){ wishlist.splice(i,1); btn&&btn.classList.remove('liked'); }
  else { wishlist.push(id); if(btn){ btn.classList.add('liked'); heartBurst(btn); } }
  save('mr_wishlist', wishlist);
  updateBadges();
  if ($('#drawer').classList.contains('open') && drawerMode==='wishlist') renderDrawer();
}
let heartData=null;
fetch('heart_anim.json?v=20260921d').then(r=>r.json()).then(d=>heartData=d).catch(()=>{});
function heartBurst(btn){
  if(!btn||!heartData||!window.lottie) return;
  const r=btn.getBoundingClientRect();
  const box=document.createElement('div');
  box.style.cssText=`position:fixed;left:${r.left+r.width/2-45}px;top:${r.top+r.height/2-45}px;width:90px;height:90px;pointer-events:none;z-index:305;`;
  document.body.appendChild(box);
  try{
    const anim=lottie.loadAnimation({container:box,renderer:'svg',loop:false,autoplay:true,animationData:JSON.parse(JSON.stringify(heartData))});
    anim.addEventListener('complete',()=>{anim.destroy();box.remove();});
    setTimeout(()=>{try{anim.destroy();}catch(e){}box.remove();},2500);
  }catch(e){ box.remove(); }
}

/* ════════════════════════════════════════════════════════════
   COMPRA / SELEÇÃO DE PRESENTE
   ════════════════════════════════════════════════════════════ */
function startBuy(id){
  const p=productById(id); if(!p) return;
  pendingGift=id;
  window.open(p.link,'_blank','noopener');
}
function onReturnToSite(){
  if(pendingGift) setTimeout(askGiftConfirm,350);
  if(pendingCal){ pendingCal=false; setTimeout(()=>unlockLevel('ferro'),500); }
}
window.addEventListener('focus', onReturnToSite);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) onReturnToSite(); });

function askGiftConfirm(){
  if(!pendingGift) return;
  const p=productById(pendingGift); if(!p){ pendingGift=null; return; }
  $('#giftModalPreview').innerHTML=`<div class="wl-thumb">${mediaHTML(p)}</div><div class="wl-info"><p class="wl-name">${p.nome}</p><p class="wl-price">${money(p.preco)} · ${p.loja}</p></div>`;
  showGiftStep('gstep-ask');
  $('#giftModalOverlay').classList.add('open');
}
function showGiftStep(id){ document.querySelectorAll('#giftModalOverlay .modal-step').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
function closeGiftModal(){ $('#giftModalOverlay').classList.remove('open'); pendingGift=null; }

async function confirmGift(){
  const id=pendingGift; if(!id) return;
  const primeiroPresente = !levels['bronze'];   // 1º presente desbloqueia o nível Bronze
  await reserveWrite(id, 'reservar');
  await loadProducts();
  pendingGift=null;
  updateBadges(); renderGrid();
  if (primeiroPresente){ closeGiftModal(); unlockLevel('bronze'); }  // celebração de nível
  else { showGiftStep('gstep-done'); fireConfetti(); }
}
async function cancelGift(id){
  await reserveWrite(id, 'cancelar');
  await loadProducts();
  updateBadges(); renderGrid(); renderDrawer();
  if (location.hash.includes('produto/')) renderProduct(id);
}
/* grava reserva no servidor (ou local, no modo exemplo) */
async function reserveWrite(id, acao){
  if (localMode()){
    if (acao==='reservar') localReserved[id]=guestToken; else delete localReserved[id];
    save('mr_localReserved', localReserved);
    return;
  }
  try{
    await fetch(PRODUTOS_URL, { method:'POST', body: JSON.stringify({ action:acao, id:id, quem:guestToken }) });
  }catch(e){ console.warn('Falha ao gravar reserva', e); }
}

/* ════════════════════════════════════════════════════════════
   CONFETE ROSA (não muito claro)
   ════════════════════════════════════════════════════════════ */
function fireConfetti(){
  if(!window.confetti) return;
  const myConfetti = confetti.create($('#confetti-canvas'), { resize:true, useWorker:true });
  const cores = ['#EF9CD0','#d9569f','#c2478b','#ffffff','#171717'];
  const fim = Date.now()+1400;
  (function frame(){
    myConfetti({ particleCount:5, angle:60, spread:60, origin:{x:0}, colors:cores, scalar:1.05 });
    myConfetti({ particleCount:5, angle:120, spread:60, origin:{x:1}, colors:cores, scalar:1.05 });
    if(Date.now()<fim) requestAnimationFrame(frame);
  })();
  myConfetti({ particleCount:120, spread:90, startVelocity:42, origin:{y:0.55}, colors:cores, scalar:1.1 });
}

/* ════════════════════════════════════════════════════════════
   PROGRESSO — selos de cera (Ferro→Diamante)
   ════════════════════════════════════════════════════════════ */
const LEVELS = [
  { key:'ferro',    nome:'Ferro',    c1:'#fbe4f2', c2:'#f0c2e0', desc:'Adicionou lembrete no calendário',      locked:false },
  { key:'bronze',   nome:'Bronze',   c1:'#f6c9e3', c2:'#e79fce', desc:'Reservou um presente de cama e banho',  locked:false },
  { key:'prata',    nome:'Prata',    c1:'#EF9CD0', c2:'#df79bb', desc:'Confirmou presença no casamento',       locked:true, soon:'em breve' },
  { key:'ouro',     nome:'Ouro',     c1:'#e06fb4', c2:'#c94f9c', desc:'Adicionou o lembrete do casamento',     locked:true, soon:'em breve' },
  { key:'diamante', nome:'Diamante', c1:'#cf4f97', c2:'#a83b7c', desc:'Reservou um presente de casamento',      locked:true, soon:'em breve' },
];
let levels = load('mr_levels', {});
let pendingCal = false;
function currentLevel(){ let last=null; for(const l of LEVELS){ if(levels[l.key]) last=l; } return last; }

/* selo de cera desenhado na hora (SVG original) */
function waxPath(cx,cy,R,bumps,amp){
  const steps=bumps*2, pts=[];
  for(let i=0;i<steps;i++){ const a=(i/steps)*Math.PI*2 - Math.PI/2; const r=R+(i%2?amp:-amp); pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); }
  let d=`M ${(pts[steps-1][0]+pts[0][0])/2} ${(pts[steps-1][1]+pts[0][1])/2} `;
  for(let i=0;i<steps;i++){ const p=pts[i], n=pts[(i+1)%steps]; d+=`Q ${p[0]} ${p[1]} ${(p[0]+n[0])/2} ${(p[1]+n[1])/2} `; }
  return d+'Z';
}
const ROSE='<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M50 40c7 0 11 6 8.5 12.5C56 59 47 60 43 55c-4-5-2-13 5-16 8-3 18 3 18 14 0 12-11 20-23 17"/><path d="M33 44c-6-8-2-19 9-21"/><path d="M67 44c6-8 2-19-9-21"/><path d="M36 61c-9-2-14-11-10-20"/><path d="M64 61c9-2 14-11 10-20"/><path d="M50 64v22"/><path d="M50 79c-8-3-14-9-14-9s9-2 15 4"/><path d="M50 74c8-3 14-9 14-9s-9-2-15 4"/></g>';
function badgeSVG(l, size, unlocked){
  const id='wax'+l.key+size;
  const blob=waxPath(60,60,46,11,3.2), inner=waxPath(60,60,37,11,2.4);
  const c1=unlocked?l.c1:'#eceaec', c2=unlocked?l.c2:'#d3ced1';
  const roseC=unlocked?'rgba(110,15,72,.30)':'#b9b4b7', roseHi=unlocked?'rgba(255,255,255,.6)':'#fff';
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" class="badge-svg">
    <defs><radialGradient id="${id}" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="${c1}"/><stop offset="72%" stop-color="${c2}"/><stop offset="100%" stop-color="${c2}"/></radialGradient></defs>
    <path d="${blob}" fill="url(#${id})" stroke="rgba(0,0,0,.05)"/>
    <path d="${inner}" fill="none" stroke="rgba(0,0,0,.09)" stroke-width="1.3"/>
    <g transform="translate(0,1.4)"><g stroke="${roseHi}" stroke-width="3">${ROSE}</g></g>
    <g stroke="${roseC}" stroke-width="3">${ROSE}</g>
  </svg>`;
}

function renderProgress(){
  const cur=currentLevel();
  $('#progTag').textContent = cur ? ('Nível atual · '+cur.nome) : 'Comece sua jornada';
  const path=$('#progPath');
  path.innerHTML = LEVELS.map((l,i)=>{
    const on=!!levels[l.key];
    const soon=l.locked;
    let status = on ? '<span class="prog-status done">✓ desbloqueado</span>'
                 : soon ? `<span class="prog-status soon"><img class="tl-lockmini" src="lock.svg" alt=""> ${l.soon||'em breve'}</span>`
                        : '<span class="prog-status todo">a fazer agora</span>';
    const node=`<div class="prog-node ${on?'on':(soon?'soon':'todo')}">
        <div class="prog-badge">${badgeSVG(l,90,on)}</div>
        <div class="prog-info">
          <span class="prog-name">${l.nome}</span>
          <span class="prog-desc">${l.desc}</span>
          ${status}
        </div>
      </div>`;
    return node + (i<LEVELS.length-1?`<div class="prog-connect ${on?'on':''}"></div>`:'');
  }).join('');
}

function unlockLevel(key){
  const l=LEVELS.find(x=>x.key===key);
  if(!l || l.locked || levels[key]) return;
  levels[key]=true; save('mr_levels', levels);
  updateBadges();
  if(location.hash.includes('progresso')) renderProgress();
  celebrateLevel(l);
}
function celebrateLevel(l){
  const o=$('#levelupOverlay'), c=$('#levelupCard');
  c.innerHTML=`<div class="lu-badge">${badgeSVG(l,152,true)}</div>
    <span class="lu-tag">Nível desbloqueado</span>
    <h3 class="lu-name">Agora você é<br><b>Nível ${l.nome}</b></h3>
    <p class="lu-desc">${l.desc}</p>`;
  o.classList.add('open');
  setTimeout(()=>{ if(window.fireConfetti) fireConfetti(); }, 260);
  clearTimeout(o._t); o._t=setTimeout(()=>o.classList.remove('open'), 3000);
  o.onclick=()=>{ clearTimeout(o._t); o.classList.remove('open'); };
}

/* ════════════════════════════════════════════════════════════
   DRAWER (lista de desejos / sacola)
   ════════════════════════════════════════════════════════════ */
let drawerMode='wishlist';
async function openDrawer(mode){ drawerMode=mode; if(!PRODUCTS.length) await loadProducts(); renderDrawer(); $('#drawer').classList.add('open'); $('#drawerOverlay').classList.add('open'); }
function closeDrawer(){ $('#drawer').classList.remove('open'); $('#drawerOverlay').classList.remove('open'); }
function renderDrawer(){
  const body=$('#drawerBody');
  if (drawerMode==='wishlist'){
    $('#drawerTitle').textContent='Lista de desejos';
    const items = wishlist.map(id=>productById(id)).filter(Boolean);
    if(!items.length){ body.innerHTML=`<div class="drawer-empty">${heartSVG()}<p>Sua lista está vazia.<br>Toque no coração dos presentes que você amar. 💕</p></div>`; return; }
    body.innerHTML=items.map(p=>`
      <div class="wl-item" onclick="closeDrawer();openProduct('${p.id}')">
        <div class="wl-thumb">${mediaHTML(p)}</div>
        <div class="wl-info"><p class="wl-name">${p.nome}</p><p class="wl-price">${money(p.preco)} · ${p.loja}</p></div>
        <button class="wl-remove" onclick="event.stopPropagation();toggleLike('${p.id}');renderDrawer();renderGrid();">✕</button>
      </div>`).join('');
  } else {
    $('#drawerTitle').textContent='Meus presentes';
    const gifts = myGifts();
    if(!gifts.length){ body.innerHTML=`<div class="drawer-empty"><svg viewBox="0 0 24 24" fill="none"><path d="M6 8h12l-1 12H7L6 8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.4"/></svg><p>Sua sacola está vazia.<br>Que tal escolher um presente? 🎁</p><button class="btn-mini solid" style="margin-top:22px;width:auto;" onclick="closeDrawer();go('presentes')">Ver presentes</button></div>`; return; }
    body.innerHTML=`<div class="bag-selected">
      ${gifts.map(p=>`<div class="bag-card">
        <div class="wl-thumb">${mediaHTML(p)}</div>
        <div class="wl-info"><span class="bag-tag">Presente reservado</span><p class="wl-name">${p.nome}</p><p class="wl-price">${money(p.preco)} · ${p.loja}</p></div>
        <button class="wl-remove" title="Cancelar presente" onclick="cancelGift('${p.id}')">✕</button>
      </div>`).join('')}
      <button class="btn-mini ghost" style="margin-top:16px;" onclick="closeDrawer();go('presentes')"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Adicionar mais presentes</button>
      <p class="modal-nota" style="text-align:center;">Você pode reservar quantos quiser. Cancelar devolve o item à lista. 💕</p>
    </div>`;
  }
}

/* ════════════════════════════════════════════════════════════
   BADGES
   ════════════════════════════════════════════════════════════ */
function updateBadges(){
  const wb=$('#wlBadge'), bb=$('#bagBadge');
  if(wishlist.length){ wb.textContent=wishlist.length; wb.classList.add('show'); } else wb.classList.remove('show');
  const n=myGifts().length;
  if(n){ bb.textContent=n; bb.classList.add('show'); } else bb.classList.remove('show');
}

/* ════════════════════════════════════════════════════════════
   MENU MOBILE
   ════════════════════════════════════════════════════════════ */
const hb=$('#hamb'); if(hb) hb.addEventListener('click', ()=>{ const nl=$('#navLinks'); if(nl) nl.classList.toggle('open'); });
function closeMenu(){ const nl=$('#navLinks'); if(nl) nl.classList.remove('open'); }

/* ════════════════════════════════════════════════════════════
   RSVP MODAL
   ════════════════════════════════════════════════════════════ */
const overlay=$('#modalOverlay');
let currentRow=null;
function openRsvpModal(){ overlay.classList.add('open'); showStep('step1'); if(window.innerWidth<=780) closeMenu(); setTimeout(()=>$('#inputNome').focus(),420); }
$('#closeModal').addEventListener('click', ()=>overlay.classList.remove('open'));
overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.classList.remove('open'); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ overlay.classList.remove('open'); closeGiftModal(); closeDrawer(); } });
function showStep(id){ document.querySelectorAll('#modalOverlay .modal-step').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
$('#btnBuscar').addEventListener('click', buscarNome);
$('#inputNome').addEventListener('keydown', e=>{ if(e.key==='Enter') buscarNome(); });
async function buscarNome(){
  const nome=$('#inputNome').value.trim(); if(!nome) return;
  const btn=$('#btnBuscar'), err=$('#errorNome'); err.style.display='none';
  btn.disabled=true; btn.textContent='Buscando...';
  try{
    const res=await fetch(`${SCRIPT_URL}?nome=${encodeURIComponent(nome)}`);
    const data=await res.json();
    if(data.found){ currentRow=data.row; $('#familiaName').textContent=data.familia; showStep('step2'); }
    else err.style.display='block';
  }catch(e){ err.textContent='Erro de conexão. Tente novamente em instantes.'; err.style.display='block'; }
  btn.disabled=false; btn.textContent='Continuar →';
}
async function enviar(confirmacao){
  const tel=$('#inputTel').value.trim();
  try{ await fetch(SCRIPT_URL,{ method:'POST', body:JSON.stringify({row:currentRow,telefone:tel,confirmacao}), headers:{'Content-Type':'application/json'} }); }catch(e){}
}
$('#btnSim').addEventListener('click', async ()=>{ const b=$('#btnSim'); b.textContent='Confirmando...'; b.disabled=true; await enviar('✅ Sim'); showStep('step3sim'); });
$('#btnNao').addEventListener('click', async ()=>{ await enviar('❌ Não'); showStep('step3nao'); });

/* ════════════════════════════════════════════════════════════
   PARTÍCULAS (bokeh rosa)
   ════════════════════════════════════════════════════════════ */
const canvas=$('#canvas'), ctx=canvas.getContext('2d'); let W,H;
function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
resize(); window.addEventListener('resize', resize);
class Particle{
  constructor(init){ this.reset(init); }
  reset(init){ this.x=Math.random()*(W||800); this.y=init?Math.random()*(H||600):H+10; this.r=Math.random()*2.5+0.8; this.vy=-(Math.random()*0.3+0.08); this.vx=(Math.random()-0.5)*0.15; this.maxA=Math.random()*0.16+0.04; this.phase=Math.random()*Math.PI*2; this.speed=Math.random()*0.006+0.003; }
  update(){ this.phase+=this.speed; this.a=this.maxA*(0.5+0.5*Math.sin(this.phase)); this.x+=this.vx; this.y+=this.vy; if(this.y<-10) this.reset(false); }
  draw(){ const g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*5); g.addColorStop(0,`rgba(239,156,208,${this.a*1.6})`); g.addColorStop(1,`rgba(239,156,208,0)`); ctx.beginPath(); ctx.arc(this.x,this.y,this.r*5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle=`rgba(247,207,230,${this.a*2})`; ctx.fill(); }
}
const pts=[]; const cnt=Math.min(Math.floor(((W||1200)*(H||800))/12000),80);
for(let i=0;i<cnt;i++) pts.push(new Particle(true));
(function loop(){ ctx.clearRect(0,0,W,H); pts.forEach(p=>{p.update();p.draw();}); requestAnimationFrame(loop); })();

/* ════════════════════════════════════════════════════════════
   SCROLL REVEAL
   ════════════════════════════════════════════════════════════ */
const obs=new IntersectionObserver(entries=>{ entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); }); },{threshold:0.1});
document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale').forEach(el=>obs.observe(el));

/* ════════════════════════════════════════════════════════════
   VÍDEO DA IRMÃ (com data)
   ════════════════════════════════════════════════════════════ */
$('#irmaYear').textContent = VIDEO_ANO;
const iv=$('#irmaVideo'), ir=$('#irmaReveal'), ido=$('#irmaDateOverlay');
ido.addEventListener('click', ()=>{ ido.classList.add('hidden'); iv.play(); });
iv.addEventListener('play', ()=>ido.classList.add('hidden'));
iv.addEventListener('ended', ()=>setTimeout(()=>ir.classList.add('show'),400));
iv.addEventListener('timeupdate', ()=>{ if(iv.currentTime>iv.duration*0.6 && iv.duration>0) ir.classList.add('show'); });

/* Vídeo da dança: toca sozinho quando aparece na tela (mudo, por política do navegador) */
const dv=document.querySelector('.video-land');
if(dv){
  dv.muted=true; dv.setAttribute('playsinline','');
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ dv.play().catch(()=>{}); } else { dv.pause(); } }), {threshold:0.4}).observe(dv);
}

/* ════════════════════════════════════════════════════════════
   COUNTDOWN
   ════════════════════════════════════════════════════════════ */
function tick(){
  const diff=new Date('2026-11-14T13:00:00-03:00')-new Date();
  if(diff<=0) return;
  $('#days').textContent=String(Math.floor(diff/86400000));
  $('#hours').textContent=String(Math.floor((diff%86400000)/3600000)).padStart(2,'0');
  $('#minutes').textContent=String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
  $('#seconds').textContent=String(Math.floor((diff%60000)/1000)).padStart(2,'0');
}
tick(); setInterval(tick,1000);

/* ════════════════════════════════════════════════════════════
   ADICIONAR À AGENDA (Google Agenda pré-preenchido + .ics com aviso 3h antes)
   ════════════════════════════════════════════════════════════ */
function addCalendar(){
  // abre o Google Agenda já preenchido (sem baixar arquivo)
  const g='https://calendar.google.com/calendar/render?action=TEMPLATE'
    +'&text='+encodeURIComponent('Casamento Matheus e Rafa - Almoço 13h')
    +'&dates=20261114T160000Z/20261114T190000Z'
    +'&details='+encodeURIComponent('Casamento no civil e Chá de Cama e Banho de Matheus e Rafaella. Almoço às 13h. Te esperamos! 💕')
    +'&location='+encodeURIComponent('Rua Frei Bartolomeu Pilar, 191 - Vila Constança, São Paulo - SP')
    +'&ctz=America/Sao_Paulo';
  window.open(g,'_blank','noopener');
  pendingCal = true;   // ao voltar da agenda, desbloqueia o nível Ferro
}

/* ════════════════════════════════════════════════════════════
   INÍCIO
   ════════════════════════════════════════════════════════════ */
(async function init(){
  await loadProducts();   // carrega presentes já no começo (lista de desejos e sacola funcionam em qualquer página)
  updateBadges();
  await router();
})();
