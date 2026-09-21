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
   | **Quantidade** | Resposta curta *(quantas unidades desse item, ex: 1, 2, 4)* |
   | **Foto do presente** | **Envio de arquivo** (permitir imagens, 1 arquivo) |
   | **Fundo?** *(opcional)* | Resposta curta *(escreva **sim** se a foto já tem cenário/fundo; deixe vazio se for PNG recortado)* |
   | **Descrição** *(opcional)* | Parágrafo |

   > A pergunta de **Foto** precisa ser do tipo **"Envio de arquivo"**. O Google
   > vai pedir para você ativar isso — é normal. Quem responder precisa estar
   > logado numa conta Google para subir a imagem.

   > **Quantidade:** para itens baratos que várias pessoas podem dar (ex: uma
   > toalha de R$50), coloque um número maior (ex: **3**). O site mostra
   > "3 de 3 disponíveis" e vai baixando conforme os convidados escolhem — só
   > some da lista quando a última unidade for reservada. Para um kit único
   > (ex: jogo com 4 peças por R$200), coloque **1**. Se deixar em branco, o
   > site entende como **1**.

   > **Fundo?:** a maioria das lojas tem foto do produto recortado (fundo
   > transparente PNG) — nesses, deixe em branco. Quando a única foto boa que
   > você achar tiver cenário (uma cama montada num quarto, por exemplo),
   > escreva **sim** nessa coluna que o site encaixa a imagem preenchendo o
   > quadro, sem borda estranha.

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

## ⚠️ Se você já tinha publicado o script antes (atualizar o código)
Ao colar uma **versão nova** do `apps_script_presentes.gs`, o site **só passa a
usar o código novo depois de republicar**:

1. **Extensões → Apps Script**, cole o novo conteúdo e **Salve**.
2. **Implantar → Gerenciar implantações**.
3. Clique no **lápis (editar)** da implantação existente.
4. Em **Versão**, escolha **Nova versão** e clique **Implantar**.

Assim o **mesmo link** `/exec` continua valendo (não precisa trocar nada no site).
Se criar uma implantação totalmente nova, o link muda e aí precisa me avisar.

## Como funciona a reserva
Quando um convidado escolhe um presente e confirma, o site confere **na hora com a
planilha** se ainda há unidade disponível:
- Item com **quantidade 1** → some da lista assim que alguém reserva.
- Item com **quantidade maior** (ex: 3) → mostra "3 de 3 disponíveis" e vai
  baixando; só some quando a **última** unidade é reservada.
- Se dois convidados tentam pegar a última unidade ao mesmo tempo, **só um
  consegue** — o outro recebe um aviso e escolhe outro presente (a planilha é a
  fonte da verdade, não dá pra duplicar).

Se o convidado cancelar, a unidade dele **volta** para a lista. Tudo automático.

## Dúvidas comuns
- **A imagem não aparece?** Confirme que a foto foi enviada pelo formulário
  (o script libera a visualização sozinho). Fotos em PNG ou JPG funcionam.
- **Quero trocar o preço/loja:** edite direto na planilha.
- **Quero remover um presente:** apague a linha dele na planilha.
