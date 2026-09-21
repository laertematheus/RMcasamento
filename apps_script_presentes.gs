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
  var m = { nome:-1, loja:-1, link:-1, preco:-1, img:-1, spec:-1, qtd:-1, fundo:-1, reservado:-1 };
  headers.forEach(function (h, i) {
    var t = String(h).toLowerCase();
    if (m.nome<0 && (t.indexOf('título')>=0 || t.indexOf('titulo')>=0 || t.indexOf('presente')>=0 || t.indexOf('nome')>=0)) m.nome=i;
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

/* Transforma o link do Drive numa URL de imagem que o site consegue mostrar */
function imgUrl_(cell) {
  var id = driveId_(cell);
  if (!id) return String(cell || ''); // se já for um link normal de imagem, usa direto
  try {
    var file = DriveApp.getFileById(id);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {}
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000';
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
      reservado: map.reservado>=0 ? String(row[map.reservado]||'') : ''
    });
  }
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ─────────── SITE PEDE A LISTA ─────────── */
function doGet(e) {
  try {
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
      return json_({ ok:true, reservado:list.join(','), restam: Math.max(0, qtd - list.length) });

    } else if (body.action === 'cancelar') {
      var list2 = listaReservados_(sheet.getRange(row, colReservado).getValue());
      list2 = list2.filter(function (t) { return t !== quem; });     // tira só a minha unidade
      sheet.getRange(row, colReservado).setValue(list2.join(','));
      return json_({ ok:true, reservado:list2.join(',') });
    }
    return json_({ ok:false, reason:'acao' });
  } catch (err) {
    return json_({ ok:false, reason:String(err) });
  } finally {
    lock.releaseLock();
  }
}
