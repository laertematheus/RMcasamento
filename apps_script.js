// ── COLE ISSO NO APPS SCRIPT (substitui tudo) ──

function doGet(e) {
  const CORS = { 'Access-Control-Allow-Origin': '*' };
  const nome = (e.parameter.nome || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos para comparar

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const responsavel = normalize(rows[i][0]);
    const apelidos    = (rows[i][1] || '').split(',').map(normalize);
    const todos       = [responsavel, ...apelidos].filter(Boolean);

    if (todos.includes(nome)) {
      const jaConfirmado = rows[i][4] ? String(rows[i][4]) : '';
      return json({ found: true, familia: rows[i][2], row: i + 1, jaConfirmado });
    }
  }

  return json({ found: false });
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = JSON.parse(e.postData.contents);
  const row   = Number(data.row);

  sheet.getRange(row, 4).setValue(data.telefone   || '');
  sheet.getRange(row, 5).setValue(data.confirmacao || '');
  sheet.getRange(row, 6).setValue(new Date().toLocaleString('pt-BR'));

  return json({ status: 'ok' });
}

function normalize(s) {
  return String(s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
