# 🎁 Guia: como cadastrar os presentes (para a Rafaella preencher)

O site puxa os presentes de uma **planilha do Google**, que é preenchida por um
**Formulário Google**. Ninguém mexe em código: é só preencher o formulário e subir a foto.

---

## Parte 1 — Criar o formulário (o Matheus faz uma vez)

1. Acesse **https://forms.google.com** e crie um formulário em branco.
2. Dê o nome: **Presentes — Matheus & Rafaella**.
3. Crie **exatamente estas perguntas** (a ordem não importa, mas o texto ajuda):

   | Pergunta | Tipo |
   |---|---|
   | **Título do presente** | Resposta curta |
   | **Loja de referência** | Resposta curta |
   | **Link do produto** | Resposta curta |
   | **Preço** | Resposta curta *(ex: 279,90 — só o número)* |
   | **Foto do presente** | **Envio de arquivo** (permitir imagens, 1 arquivo) |
   | **Descrição** *(opcional)* | Parágrafo |

   > A pergunta de **Foto** precisa ser do tipo **"Envio de arquivo"**. O Google
   > vai pedir para você ativar isso — é normal. Quem responder precisa estar
   > logado numa conta Google para subir a imagem.

4. No topo, clique em **Respostas → Vincular a planilha → Criar planilha**.
   Isso cria a planilha que guarda tudo.

---

## Parte 2 — Ligar a planilha ao site (o Matheus faz uma vez)

1. Abra a **planilha** que foi criada.
2. Menu **Extensões → Apps Script**.
3. Apague o que estiver lá e **cole todo o conteúdo do arquivo
   `apps_script_presentes.gs`** (está aqui no projeto).
4. Clique em **Salvar** (ícone de disquete).
5. Clique em **Implantar → Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - Clique **Implantar** e **autorize** (vai pedir permissão para a sua conta — aceite).
6. Copie o **link do App da Web** que aparece (termina com `/exec`).
7. **Me mande esse link** que eu colo no site (no arquivo `js/app.js`, linha `PRODUTOS_URL`).
   Depois disso o site passa a mostrar os presentes de verdade. ✨

---

## Parte 3 — Cadastrar os 30 presentes (a Rafaella faz)

1. Abra o **link do formulário** (o Matheus te envia).
2. Para cada presente, preencha: título, loja, link, preço e **suba a foto (PNG)**.
3. Clique em **Enviar**. Em seguida clique em **"Enviar outra resposta"** e repita.
4. Pronto! Cada envio vira um presente no site automaticamente (aparece em até 1 minuto).

**Para corrigir algo depois:** é só abrir a **planilha** e editar a célula (preço, título, etc.).

---

## Como funciona a reserva
Quando um convidado escolhe um presente e confirma, o site marca **"Reservado"**
na planilha e o presente **some da lista para os outros**. Se o convidado cancelar,
ele **volta** para a lista. Tudo automático.

## Dúvidas comuns
- **A imagem não aparece?** Confirme que a foto foi enviada pelo formulário
  (o script libera a visualização sozinho). Fotos em PNG ou JPG funcionam.
- **Quero trocar o preço/loja:** edite direto na planilha.
- **Quero remover um presente:** apague a linha dele na planilha.
