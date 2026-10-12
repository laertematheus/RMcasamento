/**
 * ═══════════════════════════════════════════════════════════════
 *  APPS SCRIPT — LISTA DE PRESENTES (Matheus & Rafaella)
 * ───────────────────────────────────────────────────────────────
 *  Este código fica ligado à PLANILHA que recebe as respostas do
 *  Formulário Google dos presentes.
 *
 *  O QUE ELE FAZ:
 *   • doGet()  -> devolve todos os presentes em JSON para o site
 *   • doPost() -> reserva / cancela um presente (some da lista p/ todos)
 *
 *  Como instalar: veja o arquivo GUIA-PRESENTES.md
 * ═══════════════════════════════════════════════════════════════
 */

// Se a planilha tiver mais de uma aba, escreva aqui o nome da aba das respostas.
// Deixe '' para usar a primeira aba automaticamente.
var NOME_DA_ABA = '';

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (NOME_DA_ABA) return ss.getSheetByName(NOME_DA_ABA);
  return ss.getSheets()[0];
}

/* Descobre em qual coluna está cada informação, pelo texto do cabeçalho */
function mapColunas_(headers) {
  var m = { nome:-1, loja:-1, link:-1, preco:-1, img:-1, spec:-1, qtd:-1, fundo:-1, reservado:-1, entrega:-1 };
  headers.forEach(function (h, i) {
    var t = String(h).toLowerCase();
    if (m.entrega<0 && (t.indexOf('entrega')>=0 || t.indexOf('prazo')>=0)) m.entrega=i;   // "Entrega estimada" (dias)
    else if (m.nome<0 && (t.indexOf('título')>=0 || t.indexOf('titulo')>=0 || t.indexOf('presente')>=0 || t.indexOf('nome')>=0)) m.nome=i;
    else if (m.loja<0 && t.indexOf('loja')>=0) m.loja=i;
    else if (m.link<0 && t.indexOf('link')>=0) m.link=i;
    else if (m.preco<0 && (t.indexOf('preço')>=0 || t.indexOf('preco')>=0 || t.indexOf('valor')>=0)) m.preco=i;
    else if (m.qtd<0 && (t.indexOf('quantidade')>=0 || t.indexOf('qtd')>=0 || t.indexOf('unidade')>=0)) m.qtd=i;
    else if (m.fundo<0 && t.indexOf('fundo')>=0) m.fundo=i;
    else if (m.img<0 && (t.indexOf('foto')>=0 || t.indexOf('imagem')>=0 || t.indexOf('image')>=0)) m.img=i;
    else if (m.spec<0 && (t.indexOf('descri')>=0 || t.indexOf('especifica')>=0 || t.indexOf('detalhe')>=0)) m.spec=i;
    else if (m.reservado<0 && t.indexOf('reservado')>=0) m.reservado=i;
  });
  return m;
}

/* lista de convidados que já reservaram uma unidade (tokens separados por vírgula) */
function listaReservados_(cell) {
  return String(cell || '').split(/[;,]/).map(function (s) { return s.trim(); }).filter(String);
}
function qtdDaLinha_(sheet, map, row) {
  if (map.qtd < 0) return 1;
  var v = parseInt(String(sheet.getRange(row, map.qtd + 1).getValue()).replace(/\D/g, ''), 10);
  return v > 0 ? v : 1;
}

/* Garante que exista a coluna "Reservado" (cria no final se não existir) */
function garanteColunaReservado_(sheet, headers, map) {
  if (map.reservado >= 0) return map.reservado;
  var col = headers.length + 1;
  sheet.getRange(1, col).setValue('Reservado');
  return col - 1; // índice 0-based
}

/* Extrai o ID do arquivo do Drive de uma URL do Google */
function driveId_(url) {
  if (!url) return '';
  var m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

/* Transforma o link do Drive numa URL de imagem que o site consegue mostrar.
   Usa a CDN do Google (lh3.googleusercontent.com), bem mais confiável em <img>
   do que o antigo drive.google.com/thumbnail (que o Google costuma bloquear). */
function imgUrl_(cell) {
  var raw = String(cell || '').trim();
  if (!raw) return '';
  var id = driveId_(raw);
  if (!id) return raw; // já é uma URL direta OU um nome de arquivo hospedado no próprio site
  garantePublico_(id); // libera a visualização — só na 1ª vez (cacheado)
  return 'https://lh3.googleusercontent.com/d/' + id + '=w1080';
}

/* Libera a foto para "qualquer pessoa com o link" APENAS quando necessário e
   guarda em cache por 6h. Assim o site para de chamar o Drive a cada carregamento
   (era exatamente isso que deixava a lista lenta, ~10s). */
function garantePublico_(id) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('pub_' + id)) return;    // já liberado uma vez -> nunca mais mexe no Drive
    DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('pub_' + id, '1');           // marca permanente
  } catch (err) {}
}

function getProdutos_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var map = mapColunas_(headers);
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var nome = map.nome>=0 ? row[map.nome] : '';
    if (!nome) continue; // linha vazia
    out.push({
      id: String(r + 1), // número da linha na planilha
      nome: String(nome),
      loja: map.loja>=0 ? String(row[map.loja]||'') : '',
      link: map.link>=0 ? String(row[map.link]||'') : '',
      preco: map.preco>=0 ? String(row[map.preco]||'') : '',
      img: map.img>=0 ? imgUrl_(row[map.img]) : '',
      spec: map.spec>=0 ? String(row[map.spec]||'') : '',
      qtd: map.qtd>=0 ? String(row[map.qtd]||'1') : '1',
      fundo: map.fundo>=0 ? String(row[map.fundo]||'') : '',
      reservado: map.reservado>=0 ? String(row[map.reservado]||'') : '',
      entrega: map.entrega>=0 ? String(row[map.entrega]||'') : ''
    });
  }
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════ CONVIDADOS (identidade por familia, aba "Convidados") ═══════════
   Estrutura da aba: A Nome | B Apelidos(virgula) | C Familia | D..F | G Desejos | H Niveis
   O convidado digita o nome; achamos a familia dele. Desejos/niveis ficam na
   1a linha daquela familia (compartilhado por todos os membros). */
var CV = { nome:0, apelidos:1, familia:2, presente:6, niveis:7, desejos:8 };  // 0-based: G=Presente (nomes dos presentes reservados), H=Badge, I=Desejos (corações)
function parseArr_(v){ try{ var a=JSON.parse(v); return Array.isArray(a)?a:[]; }catch(e){ return String(v||'').split(',').map(function(s){return s.trim();}).filter(String); } }
function parseObj_(v){ try{ var o=JSON.parse(v); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
var _DIAC = new RegExp('[\\u0300-\\u036f]','g');   // remove acentos (ASCII-safe, sem caractere invisivel)
function normNome_(s){ return String(s||'').toLowerCase().trim().normalize('NFD').replace(_DIAC,'').replace(/\s+/g,' '); }
function convSheet_(aba){
  var nome = (aba && String(aba).indexOf('Convidados') === 0) ? String(aba) : 'Convidados';  // só abas "Convidados*"
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
}
/* 1a linha (canonica) de uma familia — pra todos os membros compartilharem o mesmo estado */
function linhaCanonica_(vals, fam){
  var alvo = String(fam).trim().toLowerCase();
  for(var i=1;i<vals.length;i++){ if(String(vals[i][CV.familia]).trim().toLowerCase()===alvo) return i+1; }  // ignora espaço/maiúscula sobrando
  return -1;
}
/* palavras que NÃO identificam ninguém (ignoradas na busca) */
var STOP_ = { 'familia':1,'e':1,'de':1,'da':1,'do':1,'das':1,'dos':1,'a':1,'o':1,'filhos':1,'filho':1,'filha':1,'filhas':1,
  'vo':1,'tia':1,'tio':1,'namorada':1,'namorado':1,'dona':1,'seu':1 };  // "Vó Beth" não pode bater com toda vó da lista
/* todas as palavras de uma linha: Nome + Apelidos + Familia (ex: "Késia, Samuel" acha o Samuel) */
function palavrasLinha_(r){
  var txt = [r[CV.nome], r[CV.apelidos], r[CV.familia]].map(normNome_).join(' ');
  return txt.split(/[^a-z0-9]+/).filter(function(w){ return w && !STOP_[w]; });
}
/* distância de edição <= 1 (perdoa 1 letra: Ludmilla x Ludmila, Kesia x Kezia) */
function quase_(a, b){
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a.length < 4 || b.length < 4) return false;
  var i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length){
    if (a[i] === b[j]){ i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}
/* busca o nome (em Nome, Apelidos OU Familia) e devolve as familias que batem.
   1º tenta exato; se nada bater, tenta com tolerância de 1 letra. */
function identificar_(nome, aba){
  var sh = convSheet_(aba);
  if(!sh) return { found:false, matches:[] };
  var tokens = normNome_(nome).split(/[^a-z0-9]+/).filter(function(w){ return w && !STOP_[w]; });
  if(!tokens.length) return { found:false, matches:[] };
  var vals = sh.getDataRange().getValues();
  function busca(cmp){
    var matches = [], vistos = {};
    for(var i=1;i<vals.length;i++){
      var ws = palavrasLinha_(vals[i]); if(!ws.length) continue;
      var bate = tokens.some(function(t){ return ws.some(function(w){ return cmp(t, w); }); });
      if(!bate) continue;
      var famTxt = String(vals[i][CV.familia]||'').trim();
      var fam = famTxt || String(vals[i][CV.nome]||('linha '+(i+1)));
      if(vistos[fam.toLowerCase()]) continue;
      vistos[fam.toLowerCase()] = true;
      var canon = famTxt ? linhaCanonica_(vals, famTxt) : -1; if(canon<2) canon=i+1;
      var membros = [];   // nomes de quem está nessa família (pra pessoa reconhecer a dela)
      for(var k=1;k<vals.length;k++){
        var mesma = famTxt ? String(vals[k][CV.familia]||'').trim().toLowerCase()===famTxt.toLowerCase() : k===i;
        if(mesma && String(vals[k][CV.nome]||'').trim()) membros.push(String(vals[k][CV.nome]).trim());
      }
      matches.push({ row:canon, familia:fam, membros:membros });
    }
    return matches;
  }
  var m = busca(function(a,b){ return a===b; });
  if(!m.length) m = busca(quase_);
  return { found:m.length>0, matches:m };
}
/* estado (desejos/niveis) de uma familia, pela linha canonica */
function estadoConvidado_(row, aba){
  var sh = convSheet_(aba); if(!sh) return { ok:false };
  var r = Number(row); if(r<2) return { ok:false };
  var v = sh.getRange(r,1,1,9).getValues()[0];
  return { ok:true, familia:String(v[CV.familia]||''), desejos:parseArr_(v[CV.desejos]), niveis:parseObj_(v[CV.niveis]) };
}

/* escreve na coluna G (Presente) da família os NOMES dos presentes que ela reservou
   -> a planilha interna mostra quem deu o quê. Só p/ quem entrou com o nome (chave "fam<linha>"). */
function anotaPresentes_(sheet, map, colReservado, quem, aba){
  try{
    var m = String(quem).match(/^fam(\d+)$/); if(!m) return;
    var csh = convSheet_(aba); if(!csh) return;
    var vals = sheet.getDataRange().getValues(), nomes = [];
    for (var r = 1; r < vals.length; r++){
      if (listaReservados_(vals[r][colReservado-1]).indexOf(quem) >= 0) nomes.push(String(vals[r][map.nome]));
    }
    csh.getRange(Number(m[1]), CV.presente+1).setValue(nomes.join(', '));
  }catch(err){}
}

/* ─────────── SITE PEDE A LISTA / IDENTIFICA CONVIDADO ─────────── */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.acao === 'identificar') return json_(identificar_(e.parameter.nome, e.parameter.aba));
    if (e && e.parameter && e.parameter.acao === 'estado')      return json_(estadoConvidado_(e.parameter.row, e.parameter.aba));
    return json_(getProdutos_());
  } catch (err) {
    return json_({ erro: String(err) });
  }
}

/* ─────────── SITE RESERVA / CANCELA UM PRESENTE ─────────── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json_({ ok:false, reason:'busy' }); }
  try {
    var body = JSON.parse(e.postData.contents);

    // salvar desejos/níveis de um convidado (aba Convidados)
    if (body.acao === 'salvarConvidado') {
      var csh = convSheet_(body.aba);
      var crow = Number(body.id);
      if (csh && crow >= 2) {
        if (body.desejos != null){
          if (!csh.getRange(1, CV.desejos+1).getValue()) csh.getRange(1, CV.desejos+1).setValue('Desejos');
          csh.getRange(crow, CV.desejos+1).setValue(JSON.stringify(body.desejos));
        }
        if (body.niveis  != null) csh.getRange(crow, CV.niveis+1).setValue(JSON.stringify(body.niveis));
      }
      return json_({ ok:true });
    }

    var sheet = getSheet_();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = mapColunas_(headers);
    var colReservado = garanteColunaReservado_(sheet, headers, map) + 1; // 1-based
    var row = Number(body.id);
    if (!row || row < 2) return json_({ ok:false, reason:'id' });

    var quem = String(body.quem || 'reservado');

    if (body.action === 'reservar') {
      var qtd  = qtdDaLinha_(sheet, map, row);                       // quantas unidades esse presente tem
      var list = listaReservados_(sheet.getRange(row, colReservado).getValue());
      if (list.indexOf(quem) >= 0) {                                 // já é meu -> idempotente
        return json_({ ok:true, reservado:list.join(','), restam: Math.max(0, qtd - list.length) });
      }
      if (list.length >= qtd) {                                      // acabou o estoque
        return json_({ ok:false, reason:'esgotado', reservado:list.join(','), restam:0 });
      }
      list.push(quem);
      sheet.getRange(row, colReservado).setValue(list.join(','));
      anotaPresentes_(sheet, map, colReservado, quem, body.aba);
      return json_({ ok:true, reservado:list.join(','), restam: Math.max(0, qtd - list.length) });

    } else if (body.action === 'cancelar') {
      var list2 = listaReservados_(sheet.getRange(row, colReservado).getValue());
      list2 = list2.filter(function (t) { return t !== quem; });     // tira só a minha unidade
      sheet.getRange(row, colReservado).setValue(list2.join(','));
      anotaPresentes_(sheet, map, colReservado, quem, body.aba);
      return json_({ ok:true, reservado:list2.join(',') });
    }
    return json_({ ok:false, reason:'acao' });
  } catch (err) {
    return json_({ ok:false, reason:String(err) });
  } finally {
    lock.releaseLock();
  }
}
