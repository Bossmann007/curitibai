# SPEC: v0.51.0 Cartórios de registro civil, Junta Militar, Defensoria and Fórum

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde tiro a segunda via da certidão de nascimento no
Centro?" with the Registro Civil das Pessoas Naturais offices IPPUC lists in that bairro, their address, hours and
phone as published. Also list the Juntas de Serviço Militar, the Defensoria Pública do Paraná's posts and the fóruns.
The tool lists places only: it never says the list of registry offices is complete, and it never promises a price,
free service or a same-day document.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 99 "Cartório de Registro Civil" (4
records: the 1º to 4º offices, three in Centro, one in Centro Cívico), 21 "Junta de Serviço Militar" (3), 105
"Defensoria Pública" (14) and 106 "Fórum" (9). robots.txt 404; the layers' metadata has empty `copyrightText` and
`description`, so no licence found (facts only, IPPUC cited, like the other GeoCuritiba layers). No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- Every registry record's `observacao` ends with a line "Cartório <surname>." (the office's trade name, a person's
  surname). That line is dropped for this type (`dropLine`); the office's number already names it.
- The registry offices' e-mails are on their own domains (one with a person's name); the Defensoria publishes
  `defensoria.pr.def.br` and a gmail address and, for 8 of 14 posts, a mobile number (two posts publish only a
  mobile); the Justiça do Trabalho fórum a `trt9.jus.br` address. The unchanged filters (e-mail `curitiba.pr.gov.br`
  only, Curitiba landlines only) drop all of them. The Juntas' `curitiba.pr.gov.br` addresses (unit mailboxes such as
  `jsm001@`) are kept.
- The Juntas, Defensoria posts and fóruns list the bairros they serve in `observacao`, in lines of up to about 500
  characters; the 160-character line cut would hide most of them. For these three types a long line is split after
  its commas into several lines of at most 160 characters (`wrapLines`), not cut. `bairro` filters by where an office
  is, not by the bairros it serves; the notes say so.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `cartorio de registro civil` (99, label "Cartório de Registro Civil"), aliases `cartorios de registro civil`,
     `registro civil`, `cartorio de registro civil das pessoas naturais`, `cartorios de registro civil das pessoas
     naturais`, `certidao de nascimento`, `certidao de casamento`, `certidao de obito`;
   - `junta militar` (21, "Junta de Serviço Militar"), aliases `juntas militares`, `junta de servico militar`,
     `juntas de servico militar`, `alistamento militar`;
   - `defensoria publica` (105, "Defensoria Pública"), aliases `defensoria`, `defensorias`, `defensorias publicas`,
     `defensoria publica do parana`, `defensoria publica do estado`;
   - `forum` (106, "Fórum"), alias `foruns`.
   No bare `cartorio`, `certidao`, `junta`, `justica` or `tribunal` alias (other kinds of cartório exist; registro de
   imóveis is a later item). None of the new names is used by another type (the uniqueness test checks it).
2. **Two optional `FacilityType` fields**, used only by these types: `dropLine` (a RegExp; matching `observacao` lines
   are left out after cleaning; only a whole line of "Cartório" and one to three capitalised names (a lowercase da/de/do/dos/das/e between them) matches, and not when the first word is a status word (Fechado, Aberto, Funciona, Distrital, Temporariamente, Atende, Em, Sem, Não), so "Cartório Souza - plantão ...",
   "Cartório Fechado." or "Cartório Funciona Em Novo Endereço." is kept; the RegExp is unambiguous, so linear) and `wrapLines` (split a line longer than 160 characters
   after its commas and semicolons; a part
   longer than that is still cut with "…"). Masking is unchanged and runs on every part.
3. **Notes** (no lead note):
   - registry: the offices IPPUC's layer lists, as published, not necessarily every registry office in
     Curitiba; hours as published (see `updated`); prices, deadlines and which office holds a given record are not in
     the layer, so call the office before going; the offices' e-mails are not shown;
   - junta: days, hours and the bairros each serves are in `hours`; `bairro` filters by where a junta is, so list them
     all and read the "Atende aos bairros" line; call before going;
   - defensoria: days, hours, areas and bairros covered are in `hours`; `bairro` filters by where a post is; who can be
     assisted is not in the layer; only Curitiba landlines and city e-mails are shown, so a post can come back with no
     phone: reach it through the Defensoria Pública do Paraná's own channels (not linked by this tool); several posts
     are inside a fórum;
   - fórum: state courts and the Justiça do Trabalho; hours, courts housed and bairros covered in `hours` (some records
     date from 2019 or 2022); `bairro` filters by where a fórum is; call before going; Defensoria is `defensoria
     publica`.
4. **Descriptions**: the `type` parameter description names the four types (and `registro civil`). Tool descriptions
   unchanged. Tool contract snapshot updated.
5. **Eval**: new q129 "Onde tiro a segunda via da certidão de nascimento no Centro?" → `city_facilities_search`
   `{type: "cartorio de registro civil", bairro: "centro"}`, expecting name, address, the hours line, phone and `note`;
   synthetic fixtures `test/fixtures/geocuritiba/{cartorio_de_registro_civil,junta_militar,defensoria_publica,forum}_synthetic.json`
   (invented names, streets, phones and e-mails, among them a personal-name e-mail on a private domain, a gmail, a
   `defensoria.pr.def.br`, a `trt9.jus.br`, a mobile next to a landline and a mobile-only record).
6. **Docs and version**: README, docs/tools.md (row, which-tool row), docs/sources.md (layers 99, 21, 105 and 106, the
   robots.txt recheck, every hand request, what is dropped), docs/roadmap-1.0.md, CHANGELOG 0.51.0, version 0.51.0 in
   `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for certidões, the Junta,
   the Defensoria or the fóruns and is unchanged.

## Out of scope

Which registry office or circunscrição serves an address (a later `place_at_point` item); registro de imóveis or
tabelionatos; ordering a certidão, prices, deadlines or online channels; linking the Defensoria's, the courts' or the
registry offices' sites; widening the e-mail or phone filters; parsing hours or bairro lists into fields; any new host
or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases resolve to layers 99, 21,
  105 and 106; bare `cartorio`, `certidao`, `junta`, `justica`, `tribunal` not types; the registry offices in Centro
  with hours as published and the "Cartório <Name>." line dropped (another "Cartório de ..." line kept); for each new
  type, synthetic personal e-mails and mobiles dropped and no price, free or same-day wording in the note; a junta's
  500-character bairro list split into lines of at most 160 characters with no "…"; a mobile-only Defensoria post
  with no phone; q129 answered.
- `node scripts/eval-summary.mjs`: `answered 125 / 129`.
- `scripts/verify` exits 0 on the PR head.
