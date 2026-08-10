DB Compare - Versao local/portatil
====================================

Esta pasta sera a distribuicao para os usuarios Windows.

Ao finalizar o empacotamento, ela contera:
- runtime\node.exe: runtime incluido, sem necessidade de instalar Node.js;
- agent\: servidor local que executa as consultas aos bancos;
- DB Compare.cmd: atalho que abre o sistema no navegador.

O agente escuta somente em 127.0.0.1 e nunca recebe uma chave administrativa
do Firebase. Ele valida a sessao pelo Firebase Authentication e executa somente
as consultas de banco solicitadas pelo site hospedado no Firebase Hosting.

Configuracao por computador
---------------------------
O arquivo agent\.env deve conter somente:

FIREBASE_API_KEY=chave_publica_do_app_web
LOCAL_PORT=38765
ALLOWED_ORIGINS=https://dbcompare-d1bc2.web.app,https://dbcompare-d1bc2.firebaseapp.com

Nao inclua neste arquivo uma chave privada ou arquivo de conta de servico do
Firebase. O site e os logs sao hospedados pelo Firebase.

Observacao: a primeira distribuicao ainda sera gerada pelo processo de
empacotamento Windows. Estes arquivos sao a estrutura e o iniciador que esse
processo utilizara.
