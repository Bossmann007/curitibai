# Como contribuir

Obrigado por querer ajudar. O CuritibAI é TypeScript (Node.js 26.13.1 ou mais novo, a versão do `.nvmrc`), com o SDK
oficial do MCP e o `zod`.

## Antes de começar

Rode `scripts/verify`. Ele precisa terminar com `verify: OK` antes e depois da sua mudança. Ele confere que nenhum
catálogo, export da URBS, saída do coletor de eventos ou página HTML capturada entrou no git e que todo link relativo
dos arquivos Markdown (README, `docs/` e estes guias) aponta para um arquivo e uma âncora que existem, e roda `npm ci`,
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
- **Fonte nova ou alterada.** Atualize `docs/sources.md` (formato, termos, robots.txt, data da checagem), as
  licenças em [docs/licences.md](docs/licences.md), o `license_note` da ferramenta e o `CHANGELOG.md`. Host novo entra em `ALLOWED_HOSTS`
  (`src/config.ts`) e na lista de hosts de [docs/privacy.md](docs/privacy.md#details).
- **Só leitura.** Nenhuma ferramenta grava, faz login, paga, agenda ou abre protocolo.

As decisões que dão forma ao projeto (só fatos de fontes sem licença, coleta noturna no branch `data`, o limite de
requisições por host, nada de acesso automático a hosts que proíbem) estão em [docs/adr/](docs/adr/README.md). Uma
mudança que contraria uma delas traz uma ADR nova no mesmo pull request.

## Fluxo do pull request

1. Crie um branch a partir de `main`.
2. Faça a mudança com teste. Comportamento novo vem com teste que falhava antes.
3. Atualize README, `docs/tools.md` (e os outros arquivos de `docs/` afetados), `docs/sources.md` e `CHANGELOG.md`
   quando o comportamento mudar.
4. Rode `scripts/verify`.
5. Abra o pull request para `main` com o modelo preenchido e o fim da saída do `scripts/verify`. O
   `scripts/verify` local é a verificação obrigatória; o workflow `.github/workflows/verify.yml` está configurado para
   rodar o mesmo script em pull requests.

## Tamanho do pull request

Pull requests pequenos, até cerca de 400 linhas alteradas (adicionadas mais removidas, contra a base). O passo
"PR-size" do workflow `verify.yml` (`scripts/pr-size.mjs`, só em pull requests) falha acima de 400, a menos que o
corpo do pull request tenha uma linha que comece com `Large PR because:` seguida do motivo. Editar o corpo roda o
workflow de novo.

Não contam: tudo em `test/` (testes e fixtures), `package-lock.json` e arquivos `*.lock` de qualquer pasta. Um
arquivo renomeado ou movido (por exemplo dentro de `docs/`) conta só as linhas editadas, porque o git detecta a
renomeação; um arquivo movido de `test/` para fora conta inteiro. A linha `Large PR because:` precisa estar visível:
dentro de um comentário HTML ou de um bloco de código ela não vale. Texto copiado
de um arquivo para outro novo (por exemplo um trecho do README que vira um arquivo em `docs/`) não é renomeação e
conta inteiro; explique com `Large PR because:` ou divida o pull request.

Ideia de fonte nova: use o formulário
[Sugerir uma fonte de dados](https://github.com/Bossmann007/curitibai/issues/new?template=data-source.yml) antes de
escrever código. Falha de segurança: veja [SECURITY.md](SECURITY.md).
