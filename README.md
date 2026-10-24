# Diário Glicêmico: versão para qualquer celular

Página + função de servidor. O paciente (ou o pesquisador) abre o link no navegador, fotografa o diário, digita o **código de acesso** e a leitura roda no servidor, usando a API da Anthropic. Não precisa de conta no Claude.

```
celular  ->  index.html  ->  /api/ler (Vercel)  ->  API da Anthropic
                              guarda a chave
                              e confere o código
```

## O que você precisa

1. Conta na **Anthropic Console** (console.anthropic.com), com crédito e uma **chave de API**.
2. Conta gratuita na **Vercel** (vercel.com) e, de preferência, no **GitHub**.

## Publicar (caminho mais simples, pelo navegador)

1. Crie um repositório no GitHub e envie estes arquivos: `index.html`, `api/ler.js`, `vercel.json`, `package.json`.
2. Na Vercel: **Add New > Project**, escolha o repositório e clique em **Deploy** (sem alterar nada).
3. No projeto: **Settings > Environment Variables**, crie:
   - `ANTHROPIC_API_KEY` = sua chave (começa com `sk-ant-`)
   - `ACCESS_CODE` = um código que você inventa (ex.: `ippmg-tcc-2026`)
4. Vá em **Deployments > Redeploy** para as variáveis valerem.
5. Abra o endereço `https://seu-projeto.vercel.app` no celular, tire uma foto, digite o código e toque em **Ler diário**.

Alternativa pelo terminal: `npm i -g vercel`, depois `vercel` na pasta e `vercel --prod`.

## Segurança e custo

- A chave fica só no servidor, nunca vai para a página. Não a coloque no `index.html`.
- Quem não tem o `ACCESS_CODE` não consegue usar a leitura, o que evita que terceiros gastem seu crédito. Troque o código quando o estudo acabar.
- No console da Anthropic, defina um **limite mensal de gasto** na chave.
- O app não grava fotos nem resultados. Mesmo assim, a imagem trafega pelo servidor e pela API da Anthropic: confirme com o orientador/CEP se o TCLE e a LGPD cobrem isso. O app já pede para cobrir nome, prontuário e data de nascimento antes de fotografar.

## Modelos

- Modo **Padrão**: `claude-sonnet-5-5`.
- Modo **Cuidadoso**: `claude-opus-5-5` (mais lento e mais caro, para letra difícil).
- Para trocar, crie `MODEL_DEFAULT` e/ou `MODEL_CAREFUL` nas variáveis de ambiente.

## Problemas comuns

| Mensagem na página | O que fazer |
| --- | --- |
| Código de acesso incorreto | Conferir `ACCESS_CODE` na Vercel (e redeploy após mudar) |
| O servidor ainda não foi configurado | Faltou `ANTHROPIC_API_KEY` ou `ACCESS_CODE` |
| A chave do servidor não foi aceita | Chave inválida, revogada ou sem crédito |
| Limite de uso atingido | Aguardar alguns minutos |
| Falha temporária | Tentar de novo; se persistir, ver **Logs** do projeto na Vercel |

## Para a metodologia do TCC

O bloco "Qualidade da extração" do relatório e o CSV (colunas `valor_lido`, `valor_final`, `corrigido`, `duvida_na_leitura`, mais `tempo_leitura_s`) registram o desempenho da leitura em cada diário.
