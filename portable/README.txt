DB Compare - Versao local/portatil
====================================

Esta pasta sera a distribuicao para os usuarios Windows.

Ao finalizar o empacotamento, ela contera:
- runtime\node.exe: runtime incluido, sem necessidade de instalar Node.js;
- agent\: servidor local que executa as consultas aos bancos;
- web\: interface React compilada;
- DB Compare.cmd: atalho que abre o sistema no navegador.

O agente escuta somente em 127.0.0.1 e nunca recebe uma chave administrativa
do Firebase. Ele valida a sessao na API central e registra os logs nela.

Configuracao por computador
---------------------------
O arquivo agent\.env deve conter somente:

CONTROL_API_URL=https://endereco-seguro-da-api-central
LOCAL_PORT=38765
WEB_DIST_PATH=../web

Nao inclua neste arquivo uma chave privada ou arquivo de conta de servico do
Firebase. As configuracoes publicas do Firebase sao compiladas no frontend.

Observacao: a primeira distribuicao ainda sera gerada pelo processo de
empacotamento Windows. Estes arquivos sao a estrutura e o iniciador que esse
processo utilizara.
