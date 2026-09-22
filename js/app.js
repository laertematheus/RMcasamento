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
  { id:'e1', nome:'Jogo de toalhas de banho e rosto', preco:'149,90', img:'', loja:'Buddemeyer', link:'https://www.buddemeyer.com.br', qtd:'3', spec:'Jogo de toalhas 100% algodão, macias e de alta absorção. (Exemplo com quantidade 3 — vários convidados podem presentear.)' },
  { id:'e2', nome:'Edredom casal dupla face', preco:'189,99', img:'', loja:'Casa Riachuelo', link:'https://www.riachuelo.com.br', qtd:'1', spec:'Edredom casal reversível, quentinho e leve. (Exemplo para testar — os presentes de verdade virão da planilha.)' },
  { id:'e3', nome:'Jogo de lençóis 4 peças 200 fios', preco:'159,90', img:'', loja:'MMartan', link:'https://www.mmartan.com.br', qtd:'2', spec:'Jogo de lençóis em algodão 200 fios, toque macio. (Exemplo com quantidade 2.)' },
  { id:'e4', nome:'Kit 2 travesseiros de conforto', preco:'99,90', img:'', loja:'Magalu', link:'https://www.magazineluiza.com.br', qtd:'1', spec:'Par de travesseiros com suporte ideal para noites tranquilas. (Exemplo para testar.)' },
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

/* ── IDENTIDADE POR FAMÍLIA ──
   Se a pessoa se identifica (pelo nome, na lista do RSVP), tudo passa a ser da
   FAMÍLIA e fica salvo no servidor -> aparece em qualquer aparelho. Sem login,
   segue anônimo (por aparelho), igual antes. */
let familia = load('mr_familia', null);         // { id, nome } ou null
function guestKey(){ return familia ? ('fam'+familia.id) : guestToken; }  // chave usada nas reservas
function logado(){ return !!familia; }

const $ = s => document.querySelector(s);
const productById = id => PRODUCTS.find(p => p.id === id);

/* ── quantidade + reservas (um item pode ter várias unidades) ──
   Cada item tem uma QUANTIDADE (padrão 1). O campo "reservado" guarda a
   lista de convidados que já pegaram uma unidade (tokens separados por vírgula).
   Disponível = quantidade - quantos já reservaram. */
function qtyTotal(p){ const n = parseInt(String(p.qtd != null ? p.qtd : '1').replace(/\D/g,''),10); return n>0 ? n : 1; }
function reservedList(p){
  if (localMode()) return localReserved[p.id] ? [guestKey()] : [];
  return String(p.reservado || '').split(/[;,]/).map(s=>s.trim()).filter(Boolean);
}
function reservedCount(p){ return reservedList(p).length; }
function available(p){ return Math.max(0, qtyTotal(p) - reservedCount(p)); }
function isMine(p){ return reservedList(p).indexOf(guestKey()) >= 0; }
function isTaken(p){ return !isMine(p) && available(p) <= 0; } // esgotado (para todos)
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
      qtd: (p.qtd != null ? p.qtd : (p.quantidade != null ? p.quantidade : '1')),
      fundo: p.fundo || '',
      reservado: p.reservado || ''
    }));
    save('mr_products_cache', PRODUCTS); // guarda p/ abrir instantâneo na próxima visita
  } catch(e){
    console.warn('Falha ao buscar presentes, usando exemplos.', e);
    PRODUCTS = PRODUTOS_EXEMPLO.map(p=>({...p})); usingExamples=true;
  }
}

/* ════════════════════════════════════════════════════════════
   HELPERS DE HTML
   ════════════════════════════════════════════════════════════ */
function phSVG(){ return '<div class="gift-ph"><svg viewBox="0 0 24 24" fill="none"><path d="M20 12v9H4v-9M2 7h20v5H2V7zM12 22V7M12 7S9 2 6.5 2 4 5 4 5s1 2 4 2M12 7s3-5 5.5-5S20 5 20 5s-1 2-4 2" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg><span>foto em breve</span></div>'; }
/* PADRÃO: a imagem já tem fundo/cenário (foto de catálogo) e PREENCHE o quadro (cover).
   Só vira "recortada" (centralizada, com respiro) se a coluna Fundo disser explicitamente
   que é PNG sem fundo — ex: "recortado", "png", "sem fundo", "transparente", "nao". */
function isCut(p){ const f=String((p&&p.fundo)||'').trim().toLowerCase(); return /recort|transparen|png|sem\s*fundo|^n(a|ã)o$|^n$/.test(f); }
/* se a foto falhar, troca pelo placeholder — via função (não dá pra injetar o
   HTML do placeholder dentro do atributo onerror: ele tem aspas duplas e quebra a tag) */
function imgFail(el){ try{ el.parentNode.innerHTML = phSVG(); }catch(e){} }
function mediaHTML(p){ return p.img ? `<img class="${isCut(p)?'is-cut':''}" src="${p.img}" alt="${(p.nome||'').replace(/"/g,'&quot;')}" loading="lazy" onerror="imgFail(this)">` : phSVG(); }
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
  // 1) pinta na hora com o cache (ou o que já estiver em memória), sem tela de "carregando"
  if (!PRODUCTS.length){
    const cache = load('mr_products_cache', null);
    if (cache && cache.length){ PRODUCTS = cache.map(p=>({...p})); usingExamples=false; }
  }
  if (PRODUCTS.length){ renderGrid(); updateBadges(); }
  else grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-faint);padding:60px 0;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;">carregando presentes…</p>`;
  // 2) busca a versão fresca em segundo plano e atualiza
  await loadProducts();
  renderGrid();
  updateBadges();
}

/* ════════════════════════════════════════════════════════════
   GRADE DE PRESENTES
   ════════════════════════════════════════════════════════════ */
function renderGrid(){
  const grid = $('#giftGrid');
  if (!PRODUCTS.length){ grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--ink-faint);padding:60px 0;">A lista de presentes chega em breve</p>`; return; }
  grid.innerHTML = PRODUCTS.map(p=>{
    const liked = wishlist.includes(p.id);
    const mine = isMine(p), taken = isTaken(p);
    const total = qtyTotal(p), livre = available(p);
    let flag = '';
    if (mine)  flag = `<div class="gift-reserved-flag"><span class="rf-ico"></span><span class="rf-txt">Você escolheu</span><span class="rf-sub">${total>1 && livre>0 ? 'ainda há '+livre+' na lista' : 'está na sua sacola'}</span></div>`;
    else if (taken) flag = `<div class="gift-reserved-flag"><span class="rf-ico">🎀</span><span class="rf-txt">Esgotado</span><span class="rf-sub">já escolhido pelos convidados</span></div>`;
    // faixa de disponibilidade só quando há mais de uma unidade
    const stock = (total>1 && livre>0 && !mine)
      ? `<span class="gift-stock">${livre} de ${total} disponíveis</span>` : '';
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
        ${stock}
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
        ${ qtyTotal(p)>1 && !mine ? `<p class="prod-stock ${available(p)>0?'':'out'}">${ available(p)>0 ? `Ainda há <b>${available(p)} de ${qtyTotal(p)}</b> disponíveis — mais de um convidado pode presentear` : 'Todas as unidades já foram escolhidas' }</p>` : '' }
        ${p.spec?`<p class="prod-spec-lbl">Especificação</p><p class="prod-spec">${p.spec}</p>`:''}
        ${p.loja?`<div class="prod-store-chip"><span class="dot"></span> Sugestão: ${p.loja}</div>`:''}
        ${ mine
          ? `<div class="prod-tip" style="background:var(--pink-pale);border:1px solid var(--pink-soft);"><b>Este é o presente que você escolheu</b><br>Ele está guardado na sua sacola.</div>
             <button class="prod-cancel" onclick="cancelGift('${p.id}')">Cancelar presente</button>`
          : taken
          ? `<div class="prod-tip"><b>Presente esgotado</b> — já foi escolhido pelos convidados.<br>Que tal escolher outro?</div>`
          : `${ !levels['bronze'] ? `<div class="prod-incentivo"><img class="pi-selo" src="selo_bronze.png?v=2" alt="Selo Bronze"><div>Escolha este presente e <b>ganhe o selo de Bronze</b></div></div>` : '' }
             <a class="prod-buy" href="${p.link}" target="_blank" rel="noopener" onclick="markPending('${p.id}')">
               <svg viewBox="0 0 24 24" fill="none"><path d="M6 8h12l-1 12H7L6 8z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
               Comprar na loja
             </a>
             <button class="prod-bought" onclick="manualBuy('${p.id}')">Já comprei este item ✓</button>
             <div class="prod-tip">Você pode comprar este item <b>na loja que preferir</b>. Vale buscar cupons e promoções — e usar o <b>Méliuz</b> para ganhar cashback.</div>` }
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
  saveFamiliaState();   // sincroniza os desejos com a família (se estiver logada)
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
// o botão "Comprar" agora é um link real (abre em nova aba no celular); só marcamos o pendente
function markPending(id){ pendingGift=id; }
// contingência manual: "Já comprei este item" -> abre o modal de confirmação na hora
function manualBuy(id){ pendingGift=id; askGiftConfirm(); }
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
  // pra o presente ficar salvo na FAMÍLIA (e aparecer em qualquer aparelho), pede o nome antes
  if(!logado() && !localMode()){
    $('#giftModalOverlay').classList.remove('open');
    openId({ title:'Antes, quem é você?', after:()=>{ pendingGift=id; askGiftConfirm(); } });
    return;
  }
  const primeiroPresente = !levels['bronze'];   // 1º presente desbloqueia o nível Bronze
  setReservedNow(id, true);                      // 1) reserva OTIMISTA (na hora, sem travar a tela)
  updateBadges(); renderGrid();
  const res = await reserveWrite(id, 'reservar');// 2) confirma no servidor (fonte da verdade)
  if (res && res.ok === false){                  // 3) servidor recusou (item esgotou entre a tela e o clique)
    setReservedNow(id, false);                   //    -> DESFAZ a reserva otimista
    updateBadges(); renderGrid();
    pendingGift=null;
    showGiftStep('gstep-taken');                 //    -> avisa o convidado
    return;
  }
  pendingGift=null;
  if (primeiroPresente){ closeGiftModal(); unlockLevel('bronze'); }  // celebração de nível
  else { showGiftStep('gstep-done'); fireConfetti(); }
}
function cancelGift(id){
  setReservedNow(id, false);         // remove na hora (sem esperar a planilha)
  reserveWrite(id, 'cancelar');      // sincroniza servidor em segundo plano (liberar é de baixo risco)
  updateBadges(); renderGrid(); renderDrawer();
  if (location.hash.includes('produto/')) renderProduct(id);
}
/* atualização OTIMISTA (na hora) — mine=true reserva uma unidade PARA MIM; false cancela a minha */
function setReservedNow(id, mine){
  const p=productById(id); if(!p) return;
  if(!localMode()){                                     // modo servidor: mexe só na MINHA presença na lista
    let list = reservedList(p);
    if(mine){ if(list.indexOf(guestKey())<0) list.push(guestKey()); }
    else    { list = list.filter(t=>t!==guestKey()); }
    p.reservado = list.join(',');
  }
  if(mine) localReserved[id]=guestKey(); else delete localReserved[id];  // modo exemplo (1 aparelho)
  save('mr_localReserved', localReserved);
}
/* grava a reserva no servidor e devolve a resposta ({ok, reservado, restam}).
   No modo exemplo (planilha vazia) resolve local. Se a rede cair, mantém o
   otimista (a trava do servidor ainda protege — o convidado pode tentar de novo). */
async function reserveWrite(id, acao){
  if (localMode()){
    if (acao==='reservar') localReserved[id]=guestKey(); else delete localReserved[id];
    save('mr_localReserved', localReserved);
    return { ok:true };
  }
  try{
    const r = await fetch(PRODUTOS_URL, { method:'POST', body: JSON.stringify({ action:acao, id:id, quem:guestKey() }) });
    const data = await r.json().catch(()=>null);
    if (data && typeof data.reservado === 'string'){    // sincroniza o estado real que o servidor devolveu
      const p=productById(id); if(p) p.reservado=data.reservado;
    }
    return data || { ok:true };
  }catch(e){ console.warn('Falha ao gravar reserva', e); return { ok:true, offline:true }; }
}

/* ════════════════════════════════════════════════════════════
   CONFETE ROSA (não muito claro)
   ════════════════════════════════════════════════════════════ */
let _mc = null; // instância do confete (criada UMA vez — recriar quebra o canvas)
/* garante que o canvas do confete ocupe a TELA TODA (senão fica 300x150 e o
   confete amontoa no canto superior esquerdo) */
function sizeConfetti(){ const cv=$('#confetti-canvas'); if(cv){ cv.width=window.innerWidth; cv.height=window.innerHeight; } }
window.addEventListener('resize', sizeConfetti);
function fireConfetti(){
  if(!window.confetti) return;
  const cv=$('#confetti-canvas'); if(!cv) return;
  sizeConfetti();                                     // dimensiona antes de cada disparo
  if(!_mc){ try{ _mc = confetti.create(cv, { resize:false, useWorker:false }); }catch(e){ _mc=window.confetti; } }
  const mc = _mc || window.confetti;
  const cores = ['#EF9CD0','#f297b8','#e572b4','#d9569f','#ffffff','#fbe4f2']; // paleta rosa (rosa claro→escuro + branco)
  const fim = Date.now()+1500;
  (function frame(){ // chuva suave do topo, espalhada na largura toda (partículas pequenas)
    mc({ particleCount:4, startVelocity:0, ticks:240, gravity:0.65, spread:120, scalar:0.65, origin:{ x:Math.random(), y:-0.08 }, colors:cores });
    if(Date.now()<fim) requestAnimationFrame(frame);
  })();
  mc({ particleCount:70, spread:75, startVelocity:32, scalar:0.75, origin:{y:0.4}, colors:cores }); // estouro central suave
}

/* ════════════════════════════════════════════════════════════
   PROGRESSO — selos de cera (Ferro→Diamante)
   ════════════════════════════════════════════════════════════ */
const LEVELS = [
  { key:'ferro',    nome:'Ferro',    img:'selo_ferro.png?v=2',    desc:'Adicionou lembrete no calendário',      locked:false },
  { key:'bronze',   nome:'Bronze',   img:'selo_bronze.png?v=2',   desc:'Reservou um presente de cama e banho',  locked:false },
  { key:'prata',    nome:'Prata',    img:'selo_prata.png?v=2',    desc:'Confirmou presença no casamento',       locked:true, soon:'em breve' },
  { key:'ouro',     nome:'Ouro',     img:'selo_ouro.png?v=2',     desc:'Adicionou o lembrete do casamento',     locked:true, soon:'em breve' },
  { key:'diamante', nome:'Diamante', img:'selo_diamante.png?v=2', desc:'Reservou um presente de casamento',     locked:true, soon:'em breve' },
];
/* selo do nível = imagem enviada pelos noivos (fundo transparente) */
function badgeHTML(l, size){ return `<img class="badge-img" src="${l.img}" alt="Selo ${l.nome}" style="width:${size}px;height:${size}px">`; }
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
                        : `<button class="prog-status todo" onclick="progAction('${l.key}')">Fazer agora →</button>`;
    const node=`<div class="prog-node ${on?'on':(soon?'soon':'todo')}">
        <div class="prog-badge">${badgeHTML(l,90)}</div>
        <div class="prog-info">
          <span class="prog-name">${l.nome}</span>
          <span class="prog-desc">${l.desc}</span>
          ${status}
        </div>
      </div>`;
    return node + (i<LEVELS.length-1?`<div class="prog-connect ${on?'on':''}"></div>`:'');
  }).join('') + `<div class="prog-prize"><span class="prog-prize-tag">Recompensa final</span>Chegando ao nível <b>Diamante</b>, uma surpresa especial dos noivos espera por você no fim da jornada.</div><div class="prog-reset-wrap"><button class="prog-reset" onclick="openResetModal()">↺ Reiniciar meu progresso</button></div>`;
}
function openResetModal(){ $('#resetOverlay').classList.add('open'); }
function closeResetModal(){ $('#resetOverlay').classList.remove('open'); }
function resetProgress(){
  ['mr_levels','mr_wishlist','mr_selectedGift','mr_localReserved','mr_takenGifts'].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  levels={}; wishlist=[]; localReserved={};
  PRODUCTS.forEach(p=>p.reservado='');
  saveFamiliaState();   // se logada, zera também no servidor
  closeResetModal(); updateBadges(); renderGrid(); renderProgress();
  go('progresso');
}

function unlockLevel(key){
  const l=LEVELS.find(x=>x.key===key);
  if(!l || l.locked || levels[key]) return;
  levels[key]=true; save('mr_levels', levels); saveFamiliaState();
  updateBadges();
  if(location.hash.includes('progresso')) renderProgress();
  celebrateLevel(l);
}
function celebrateLevel(l){
  fireConfetti();                       // 1) confete primeiro
  setTimeout(()=>{                       // 2) depois entra o selo evoluindo
    const o=$('#levelupOverlay'), c=$('#levelupCard');
    c.innerHTML=`<div class="lu-badge">${badgeHTML(l,152)}</div>
      <span class="lu-tag">Nível desbloqueado</span>
      <h3 class="lu-name">Agora você é<br><b>Nível ${l.nome}</b></h3>
      <p class="lu-desc">${l.desc}</p>`;
    o.classList.add('open');
    setTimeout(fireConfetti, 350);        // mais confete junto do selo
    clearTimeout(o._t); o._t=setTimeout(()=>o.classList.remove('open'), 3200);
    o.onclick=()=>{ clearTimeout(o._t); o.classList.remove('open'); };
  }, 550);
}
/* botão "Fazer agora" da barra de progresso -> leva para onde a ação acontece */
function progAction(key){
  if(key==='bronze') go('presentes');
  else if(key==='ferro'){ go(''); setTimeout(()=>document.querySelector('.tl-sec')?.scrollIntoView({behavior:'smooth'}),150); }
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
    if(!items.length){ body.innerHTML=`<div class="drawer-empty">${heartSVG()}<p>Sua lista está vazia.<br>Toque no coração dos presentes que você amar.</p></div>`; return; }
    body.innerHTML=items.map(p=>`
      <div class="wl-item" onclick="closeDrawer();openProduct('${p.id}')">
        <div class="wl-thumb">${mediaHTML(p)}</div>
        <div class="wl-info"><p class="wl-name">${p.nome}</p><p class="wl-price">${money(p.preco)} · ${p.loja}</p></div>
        <button class="wl-remove" onclick="event.stopPropagation();toggleLike('${p.id}');renderDrawer();renderGrid();">✕</button>
      </div>`).join('');
  } else {
    $('#drawerTitle').textContent='Meus presentes';
    const gifts = myGifts();
    if(!gifts.length){ body.innerHTML=`<div class="drawer-empty"><svg viewBox="0 0 24 24" fill="none"><path d="M6 8h12l-1 12H7L6 8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.4"/></svg><p>Sua sacola está vazia.<br>Que tal escolher um presente?</p><button class="btn-mini solid" style="margin-top:22px;width:auto;" onclick="closeDrawer();go('presentes')">Ver presentes</button></div>`; return; }
    body.innerHTML=`<div class="bag-selected">
      ${gifts.map(p=>`<div class="bag-card">
        <div class="wl-thumb">${mediaHTML(p)}</div>
        <div class="wl-info"><span class="bag-tag">Presente reservado</span><p class="wl-name">${p.nome}</p><p class="wl-price">${money(p.preco)} · ${p.loja}</p></div>
        <button class="wl-remove" title="Cancelar presente" onclick="cancelGift('${p.id}')">✕</button>
      </div>`).join('')}
      <button class="btn-mini ghost" style="margin-top:16px;" onclick="closeDrawer();go('presentes')"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Adicionar mais presentes</button>
      <p class="modal-nota" style="text-align:center;">Você pode reservar quantos quiser. Cancelar devolve o item à lista.</p>
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
$('#btnSim').addEventListener('click', async ()=>{ const b=$('#btnSim'); b.textContent='Confirmando...'; b.disabled=true; await enviar('✅ Sim'); if(currentRow) applyFamilia(currentRow, $('#familiaName').textContent); showStep('step3sim'); });
$('#btnNao').addEventListener('click', async ()=>{ await enviar('❌ Não'); if(currentRow) applyFamilia(currentRow, $('#familiaName').textContent); showStep('step3nao'); });

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
/* Os dois vídeos tocam sozinhos ao aparecer (estilo reels); som liga no 1º toque (política do navegador) */
let soundOn=false;
const ir=$('#irmaReveal'), iv=$('#irmaVideo');
function setupReel(v){
  if(!v) return;
  v.muted=true; v.volume=0.8; v.setAttribute('playsinline','');
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ v.muted=!soundOn; v.play().catch(()=>{}); } else { v.pause(); } }), {threshold:0.3}).observe(v);
}
setupReel(document.querySelector('.video-land'));
setupReel(iv);
if(iv && ir){ iv.addEventListener('timeupdate', ()=>{ if(iv.currentTime>iv.duration*0.55 && iv.duration>0) ir.classList.add('show'); }); }
const unmuteAll=()=>{ soundOn=true; document.querySelectorAll('video').forEach(v=>{ v.muted=false; v.volume=0.8; }); };
['pointerdown','touchstart','keydown'].forEach(ev=>document.addEventListener(ev, unmuteAll, {once:true}));

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
    +'&details='+encodeURIComponent('Casamento no civil e Chá de Cama e Banho de Matheus e Rafaella. Almoço às 13h. Te esperamos!')
    +'&location='+encodeURIComponent('Rua Frei Bartolomeu Pilar, 191 - Vila Constança, São Paulo - SP')
    +'&ctz=America/Sao_Paulo';
  window.open(g,'_blank','noopener');
  pendingCal = true;   // ao voltar da agenda, desbloqueia o nível Ferro
}

/* ════════════════════════════════════════════════════════════
   IDENTIDADE POR FAMÍLIA  (login por nome, salva no servidor via RSVP)
   ════════════════════════════════════════════════════════════ */
let idAfter = null;  // callback após o login (ex: retomar a reserva)
function openId(opts){
  opts = opts || {};
  idAfter = opts.after || null;
  const t=$('#idTitle'); if(t) t.textContent = opts.title || 'Quem é você?';
  idStep('id-step-nome');
  const err=$('#idErro'); if(err) err.style.display='none';
  const inp=$('#idNome'); if(inp) inp.value='';
  $('#idOverlay').classList.add('open');
  setTimeout(()=>{ const i=$('#idNome'); if(i) i.focus(); }, 300);
}
function closeId(){ $('#idOverlay').classList.remove('open'); }
function idStep(id){ document.querySelectorAll('#idOverlay .modal-step').forEach(s=>s.classList.remove('active')); const el=$('#'+id); if(el) el.classList.add('active'); }
async function idBuscar(){
  const nome=$('#idNome').value.trim(); if(!nome) return;
  const b=$('#idBuscar'), err=$('#idErro'); if(err) err.style.display='none';
  b.disabled=true; b.textContent='Buscando...';
  try{
    const res=await fetch(`${SCRIPT_URL}?nome=${encodeURIComponent(nome)}`);
    const data=await res.json();
    const matches = (data.matches && data.matches.length) ? data.matches : (data.found ? [{row:data.row, familia:data.familia}] : []);
    if(!matches.length){ if(err) err.style.display='block'; }
    else if(matches.length===1){ await setFamilia(matches[0].row, matches[0].familia); }
    else { showFamiliaPicker(matches); }
  }catch(e){ if(err){ err.textContent='Erro de conexão. Tente de novo em instantes.'; err.style.display='block'; } }
  b.disabled=false; b.textContent='Continuar →';
}
function showFamiliaPicker(matches){
  const esc = s => String(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
  $('#idFamiliaList').innerHTML = matches.map(m=>{
    const nome = m.familia || ('Família de '+(m.responsavel||'')) || 'Família';
    return `<button class="id-fam-btn" onclick="pickFamilia(${m.row}, '${esc(nome)}')">${nome}</button>`;
  }).join('');
  idStep('id-step-familia');
}
async function pickFamilia(row, nome){ await setFamilia(row, nome); }
/* aplica a identidade (usado tanto pelo modal quanto pelo RSVP), SEM tocar na UI do modal */
async function applyFamilia(id, nome){
  familia = { id:id, nome:nome || 'Família' };
  save('mr_familia', familia);
  await loadFamiliaState();          // traz desejos + níveis já salvos
  updateIdentityUI(); updateBadges(); renderGrid();
  if(location.hash.includes('progresso')) renderProgress();
}
async function setFamilia(id, nome){
  await applyFamilia(id, nome);
  if(idAfter){ const cb=idAfter; idAfter=null; closeId(); setTimeout(cb, 250); return; }  // veio de uma reserva: fecha e retoma
  const okt=$('#idOkTitle'); if(okt) okt.textContent = 'Oi, ' + familia.nome + '!';
  idStep('id-step-ok');
}
let familiaSyncOk = false;   // só sincroniza desejos/níveis se o script NOVO do RSVP responder (senão, não grava — evita apagar o RSVP)
async function loadFamiliaState(){
  if(!familia) return;
  try{
    const res=await fetch(`${SCRIPT_URL}?acao=estado&row=${encodeURIComponent(familia.id)}`);
    const d=await res.json();
    if(d && d.ok){
      familiaSyncOk = true;   // script novo confirmado -> pode salvar com segurança
      if(Array.isArray(d.desejos)){ wishlist = d.desejos.slice(); save('mr_wishlist', wishlist); }
      if(d.niveis && typeof d.niveis==='object'){ levels = Object.assign({}, d.niveis); save('mr_levels', levels); }
    }
  }catch(e){ console.warn('estado da família falhou', e); }
}
let _saveFamTimer=null;
function saveFamiliaState(){
  if(!familia || !familiaSyncOk) return;   // trava: não grava se o script novo não estiver ativo
  clearTimeout(_saveFamTimer);
  _saveFamTimer=setTimeout(()=>{
    fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify({ acao:'salvar', row:familia.id, desejos:wishlist, niveis:levels }) }).catch(()=>{});
  }, 700);
}
function sairFamilia(){
  familia=null; try{ localStorage.removeItem('mr_familia'); }catch(e){}
  updateIdentityUI(); updateBadges(); renderGrid();
  if(location.hash.includes('progresso')) renderProgress();
}
function updateIdentityUI(){
  document.querySelectorAll('.id-chip').forEach(el=>{
    el.innerHTML = logado()
      ? `<span class="id-chip-nome">✓ ${familia.nome}</span> <button class="id-chip-link" onclick="sairFamilia()">sair</button>`
      : `<button class="id-chip-link" onclick="openId()">Entrar / recuperar meus presentes</button>`;
  });
}

/* ════════════════════════════════════════════════════════════
   INÍCIO
   ════════════════════════════════════════════════════════════ */
(async function init(){
  await loadProducts();   // carrega presentes já no começo (lista de desejos e sacola funcionam em qualquer página)
  if(familia) await loadFamiliaState();   // se já está logada num aparelho, restaura desejos/níveis
  updateIdentityUI();
  updateBadges();
  await router();
})();

/* ════════════════════════════════════════════════════════════
   INTRO EM VÍDEO
   Teste: só dispara com ?intro=1 na URL (convidados normais não veem).
   Quando aprovado, é só trocar a condição lá embaixo por "1ª visita".
   ════════════════════════════════════════════════════════════ */
function startIntro(){
  const ov=$('#introOverlay'), v=$('#introVideo'); if(!ov||!v) return;
  ov.classList.add('show');
  document.body.classList.add('intro-lock');   // trava o scroll enquanto a intro toca
  // FASE A: card de texto sozinho (~2.8s) — depois entra o vídeo
  setTimeout(()=>startIntroVideo(ov, v), 2800);
}
function startIntroVideo(ov, v){
  ov.classList.add('playing');                 // some o card, aparece o vídeo
  // atributos que o mobile exige para tocar inline sem bloquear
  v.muted=true; v.setAttribute('muted',''); v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
  v.loop=false;                               // não repete; sai sozinho perto do fim
  const tryPlay=()=>{ const p=v.play(); if(p&&p.catch) p.catch(()=>{}); };
  tryPlay();
  v.addEventListener('canplay', tryPlay, { once:true });
  // primeiro toque: liga o som E garante o play (no mobile o autoplay mudo às vezes não começa)
  const onTap=()=>{ v.muted=false; v.volume=0.9; tryPlay(); const h=$('#introHint'); if(h) h.style.opacity='0'; };
  ov.addEventListener('click', onTap, { once:true });
  ov.addEventListener('touchstart', onTap, { once:true });
  // SAI ~2s antes do fim do vídeo (pra não cortar antes do ápice)
  let done=false; const finish=()=>{ if(done) return; done=true; endIntro(); };
  v.addEventListener('timeupdate', ()=>{ if(v.duration && isFinite(v.duration) && v.currentTime >= v.duration - 0.3) finish(); });
  v.addEventListener('ended', finish);
  // fallback: fecha mesmo se o vídeo travar (usa a duração quando conhecida, senão 15s)
  let fb=setTimeout(finish, 15000);
  v.addEventListener('loadedmetadata', ()=>{ if(v.duration && isFinite(v.duration)){ clearTimeout(fb); fb=setTimeout(finish, (v.duration + 3)*1000); } });
}
function endIntro(){
  const ov=$('#introOverlay'), v=$('#introVideo'); if(!ov) return;
  document.body.classList.remove('intro-lock');
  ov.style.transition='opacity .5s ease'; ov.style.opacity='0';   // fade suave
  setTimeout(()=>{ ov.classList.remove('show'); ov.style.opacity=''; ov.style.transition=''; try{ v.pause(); }catch(e){} }, 500);
}
// GATILHO (modo teste): só com ?intro=1. Depois trocar por: if(!load('mr_visitou',false)){ save('mr_visitou',true); startIntro(); }
if (/[?&]intro=1(&|$)/.test(location.search)) startIntro();
