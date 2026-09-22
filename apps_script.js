// ── APPS SCRIPT DO RSVP + IDENTIDADE POR FAMÍLIA ──
// Cole isto no Apps Script da PLANILHA da lista de convidados (substitui tudo).
//
// Colunas da planilha (nesta ordem):
//   A responsável | B apelidos(vírgula) | C família | D telefone | E confirmação
//   F data | G desejos(json) | H niveis(json)
// >>> Adicione as colunas G "Desejos" e H "Niveis" se ainda não existirem. <<<

var COL = { resp:0, apelidos:1, familia:2, tel:3, conf:4, data:5, desejos:6, niveis:7 };

function sheet_() { return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); }
function normalize(s) { return String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function parseArr_(v) { try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(String); } }
function parseObj_(v) { try { var o = JSON.parse(v); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }

function doGet(e) {
  var p = e.parameter || {};
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();

  // Estado de uma família (para restaurar em qualquer aparelho)
  if (p.acao === 'estado') {
    var row = Number(p.row);
    if (!row || row < 2 || row > rows.length) return json({ ok: false });
    var r = rows[row - 1];
    return json({
      ok: true,
      familia: String(r[COL.familia] || ''),
      presenca: String(r[COL.conf] || ''),
      desejos: parseArr_(r[COL.desejos]),
      niveis: parseObj_(r[COL.niveis])
    });
  }

  // Buscar pelo nome → devolve TODAS as famílias que contêm esse nome
  var nome = normalize(p.nome);
  if (!nome) return json({ found: false, matches: [] });
  var matches = [];
  for (var i = 1; i < rows.length; i++) {
    var resp = normalize(rows[i][COL.resp]);
    var apel = String(rows[i][COL.apelidos] || '').split(',').map(normalize);
    var todos = [resp].concat(apel).filter(String);
    if (todos.indexOf(nome) >= 0) {
      matches.push({ row: i + 1, familia: String(rows[i][COL.familia] || ''), responsavel: String(rows[i][COL.resp] || '') });
    }
  }
  if (!matches.length) return json({ found: false, matches: [] });
  var first = matches[0];
  // mantém os campos antigos para compatibilidade com o RSVP
  return json({ found: true, matches: matches, familia: first.familia, row: first.row, jaConfirmado: String(rows[first.row - 1][COL.conf] || '') });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sh = sheet_();
  var row = Number(data.row);
  if (!row || row < 2) return json({ ok: false });

  // Salvar desejos/níveis da família
  if (data.acao === 'salvar') {
    var lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (err) {}
    try {
      if (data.desejos != null) sh.getRange(row, COL.desejos + 1).setValue(JSON.stringify(data.desejos));
      if (data.niveis != null) sh.getRange(row, COL.niveis + 1).setValue(JSON.stringify(data.niveis));
    } finally { try { lock.releaseLock(); } catch (e2) {} }
    return json({ ok: true });
  }

  // Confirmar presença (fluxo do RSVP, como já era)
  sh.getRange(row, COL.tel + 1).setValue(data.telefone || '');
  sh.getRange(row, COL.conf + 1).setValue(data.confirmacao || '');
  sh.getRange(row, COL.data + 1).setValue(new Date().toLocaleString('pt-BR'));
  return json({ status: 'ok', ok: true });
}
