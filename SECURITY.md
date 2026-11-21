# Segurança

O CuritibAI é um servidor MCP só de leitura: ele lê fontes públicas de Curitiba e arquivos que você guarda em
`CURITIBAI_DATA_DIR`, e devolve as respostas ao app de IA que você configurou. Se você achou uma falha, **não abra uma
issue pública**.

## Como reportar

Reporte em particular pela aba **Security → Report a vulnerability** deste repositório
(<https://github.com/Bossmann007/curitibai/security/advisories/new>). Diga a versão (`package.json`), a ferramenta, os
argumentos e o que acontece. Não mande dados pessoais reais: use valores inventados.

Respondo assim que puder. Não há prazo garantido nem recompensa.

## O que conta como falha

Por exemplo:

- o servidor acessando um host fora da lista em `src/config.ts` (`ALLOWED_HOSTS`), seguindo um redirecionamento para
  fora dela, ou recebendo um URL vindo de quem chama a ferramenta;
- uma ferramenta lendo arquivo fora de `CURITIBAI_DATA_DIR`, ou devolvendo linhas de um CSV em vez de contagens;
- um dado pessoal passando por um filtro que deveria barrá-lo (fornecedor do PNCP, unidade de saúde privada, coluna
  pessoal no `local_csv_summary`, contato de um lugar do OpenStreetMap);
- o servidor contornando um 403, um CAPTCHA, um login ou o robots.txt de uma fonte;
- texto de uma fonte que faz o servidor executar algo, gravar um arquivo ou mudar de comportamento.

## Fora do escopo

- Erros nos dados das próprias fontes (horário de ônibus errado, unidade fechada): abra uma issue comum ou avise o
  órgão que publica.
- Falhas no app de IA ou no cliente MCP que você usa.
- Ataques que exigem acesso à sua máquina ou à pasta `CURITIBAI_DATA_DIR`.

## O que o projeto promete

O servidor não grava arquivos, não guarda nem registra as consultas (só um cache em memória), não usa conta, chave nem
telemetria, e só fala com os hosts listados no README ("Privacy and safety"). O coletor de eventos
(`scripts/fetch-events.mjs`) roda à parte, só quando você o executa, e grava só em `CURITIBAI_DATA_DIR/events/`.
