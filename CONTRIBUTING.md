# Como contribuir

Obrigado por querer ajudar. O CuritibAI é TypeScript (Node.js 26.13.1 ou mais novo, a versão do `.nvmrc`), com o SDK
oficial do MCP e o `zod`.

## Antes de começar

Rode `scripts/verify`. Ele precisa terminar com `verify: OK` antes e depois da sua mudança. Ele confere que nenhum
catálogo, export da URBS, saída do coletor de eventos ou página HTML capturada entrou no git, e roda `npm ci`,
`tsc --noEmit`, `eslint`, os testes (`vitest`), o build, um teste do servidor por stdio e os limites de tempo de
`bus_stops_near` e `next_buses_near`. Os testes rodam sem rede: toda chamada é simulada.

## Regras

- **Só fatos.** Do conteúdo de terceiros guardamos fatos (datas, horários, nomes de órgãos, endereços públicos) e
  links, nunca texto copiado (descrições, notícias, páginas inteiras). Fonte sem licença encontrada fica fora do
  repositório; o usuário guarda a cópia dele em `CURITIBAI_DATA_DIR`.
- **robots.txt e nada de contornar.** Confira o robots.txt de um host antes de usá-lo e registre em
  `docs/sources.md`. Um caminho que ele proíbe nunca é acessado. Um 401, 403, CAPTCHA ou login nunca é contornado:
  nada de trocar cabeçalhos, tentar de novo ou usar um navegador automatizado. `src/http.ts` já trata isso; não mude
  esse comportamento.
- **Nenhum dado pessoal.** Nem no código, nem em testes, nem em fixtures, nem em issues. Use valores inventados. CPF
  de teste tem dígito verificador inválido (um teste confere), exceto `123.456.789-09` nos testes que checam o
  mascaramento de um CPF válido (`test/pncp.test.ts` e `test/fetchEvents.test.ts`). Uma ferramenta nova não devolve nomes de pessoas físicas, e texto livre passa pelo mesmo mascaramento
  de contato que os objetos do PNCP.
- **Fonte nova ou alterada.** Atualize `docs/sources.md` (formato, termos, robots.txt, data da checagem), a seção de
  licenças do README, o `license_note` da ferramenta e o `CHANGELOG.md`. Host novo entra em `ALLOWED_HOSTS`
  (`src/config.ts`) e na lista de hosts do README.
- **Só leitura.** Nenhuma ferramenta grava, faz login, paga, agenda ou abre protocolo.

## Fluxo do pull request

1. Crie um branch a partir de `main`.
2. Faça a mudança com teste. Comportamento novo vem com teste que falhava antes.
3. Atualize README, `docs/sources.md` e `CHANGELOG.md` quando o comportamento mudar.
4. Rode `scripts/verify`.
5. Abra o pull request para `main` com o modelo preenchido e o fim da saída do `scripts/verify`. O CI roda o mesmo
   script.

Ideia de fonte nova: use o formulário
[Sugerir uma fonte de dados](https://github.com/Bossmann007/curitibai/issues/new?template=data-source.yml) antes de
escrever código. Falha de segurança: veja [SECURITY.md](SECURITY.md).
