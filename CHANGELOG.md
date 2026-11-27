# Changelog

Newest first. Current behaviour and its sources are described in [docs/sources.md](docs/sources.md).

## 0.81.0 - 2026-11-27

Person-name filter, fifth pass (the lows of the 0.80.0 review). 27 tools. Publishes nothing.

- `city_facilities_search`, every type that hides person lines (`cei contratado`, `clube de xadrez`, `administracao
  regional`, `cohab`, `mesa solidaria`, `fazenda urbana`, `nucleo de seguranca alimentar`, `sine`, `agencia do
  trabalhador`, `liceu de oficios`, `inss`): a keyword split over two lines ("Mantida" / "pela Fulana de Tal",
  "Assistente" / "social Fulana", "Coordenação" / "geral: Fulano", "Técnica" / "Fulana") is hidden on its second line
  even when another line of the record is already hidden. Before, only the whole-field check caught it, and that
  check is skipped once a line is hidden, so the name showed. Each line is now read together with the one before it,
  the way the whole-field check reads the record, and is hidden when the pair hides and the line before does not
  hide alone; the first half stays. A second line that reads as hours or a service ("Horário: 8h", "por
  agendamento") is not read with the one before. The multi-word patterns accept a line break wherever they had a
  space. The whole-field check is now skipped only when a line hid on its own text, so a keyword split over three
  lines ("Mantido" / "por" / "Fulano de Tal Souza Lima") still hides the whole field, as before. `horta comunitaria`
  is unchanged (its allowlist already hid both halves). Known limit: when the line before hides on its own
  ("Responsável: Fulana. Mantida" / "por Fulano de Tal Souza Lima"), the pair is not read and a name of five or more
  words on the next line passes (as in 0.80.0).
- Work types (`sine`, `agencia do trabalhador`, `liceu de oficios`, `inss`): after a line whose contact phrase ends in
  "a gente", "Regional", "coordenação" or "RH" ("Falar com o RH", "Fale com a gente", "Telefone da Regional:"), a
  name on the next line is hidden ("Fulano de Tal", "Sra. Fulana", "Fulana (41) 3350-0000", "Fulana: segunda a
  sexta"). The next line is kept when it reads as hours or a service value, or when what comes before its first
  digit, "[masked]" or ':' is empty, a service or address word, or starts with a unit, channel or connector word
  ("Segunda a sexta, das 8h às 17h", "3350-0000", "pelo 156", "WhatsApp", "Atendimento presencial", "Rua XV de
  Novembro, 100", "Com agendamento"). Known limits: any other words on that line are hidden too, on the safe side;
  after "Fale com a gente pelo 156" (the phrase goes on after the unit word) a name alone on the next line still
  passes.
- "Fale com a gente pelo 156", "Telefone da Regional: …", "Tratar com o RH da empresa" and "Atendimento: emissão de
  carteira de trabalho" stay shown, also before the hours and after a hidden line.
- Checked against the real records: the 12 layers whose type hides person lines, re-read once on 2026-11-27 (306
  records, 253 with an `observacao`) and replayed offline: 131 hidden-line markers before and 131 after; every
  record's `hours` is identical. A 50 KB input of short lines runs the new check in well under the 2 s bound.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- Host contacted only for the check above (`geocuritiba.ippuc.org.br`, already allowed, one request per layer); no
  new host, link or dependency.

## 0.80.0 - 2026-11-27

Person-name filter, fourth pass (the lows of the 0.76.0 review). 27 tools. Publishes nothing.

- `city_facilities_search`, work types (`sine`, `agencia do trabalhador`, `liceu de oficios`, `inss`): "gente",
  "regional", "coordenação" and "RH" are unit words when the rest of the line holds only numbers, "[masked]",
  punctuation, channel and unit words, "empresa" and connectors, so "Dúvidas? Fale com a gente pelo 156", "Telefone
  da Regional: …", "E-mail da coordenação" and "Tratar com o RH da empresa" are shown again (0.76.0 hid them as a name
  after a channel word or "falar com"). "Falar com o RH Fulano", "Tratar com o RH da Fulana", "Telefone da Regional:
  3350-0000 - Fulana", "Fale com a gente pelo 156 ou com a Fulana", "E-mail da coordenadora" and "Coordenação: Fulana"
  stay hidden, and so do "Telefone da Regional: 156, de segunda a sexta" and "Telefone da coordenação: 3350-0000" (the
  "coordenação:" label), on the safe side. In the whole-field check (lines joined with spaces) the four words are
  plain unit words, so these lines stay shown before the hours. Known limit: a name alone on the next line after "Fale com a gente" is shown.
- "emissão de carteira de trabalho" is a service phrase after "Atendimento:", so that line is shown again;
  "emissão de carteira de trabalho - Fulana" stays hidden.
- "agendamento" (optionally "prévio" and ",", "(", ":" or "-"), then "com" and a word that is not a unit or channel
  word or an appointment detail (um/uma, no/pelo, até, mínimo, antecedência, hora, horário, documentos, comprovante,
  carteira, CPF, RG, senha), anywhere in the line, hides it: "Atendimento: agendamento com Fulana", "presencial com
  agendamento com Fulana", "mediante agendamento prévio com a Fulana" and a line "Agendamento com Fulana" are now
  hidden (0.76.0 showed them). "agendamento com a equipe", "com antecedência", "com no mínimo 48h", "com comprovante
  de residência", "com prazo de 48h" and "agendamento pelo 156" are shown. Known limits: only the first word after
  "com" is checked ("agendamento pela Fulana", "agendamento com antecedência, Fulana" pass), and "presencial com
  Fulana" still passes.
- Tested on synthetic lines for the four types, both sides, and a 50 KB timing case for the new rule.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- No request made, no new network host, no new link, no new dependency.

## 0.79.0 - 2026-11-27

Ouvidoria anonymity wording, second pass (the Security Reviewer's R1-R3 on 0.75.0). 27 tools. Publishes nothing.

- `city_service_guide` (`ouvidoria`), step 4: "Pelo guia de 2024, a forma anônima não pede cadastro e não recebe
  resposta nem acompanhamento (o CuritibAI não conferiu isso hoje no site)" is now its own sentence, apart from the
  CuritibAI's own warning that the text and the attachments can identify the citizen (before, the "no registration"
  part sat inside the sentence marked as the CuritibAI's observation).
- `what` and step 5 (e-mail) add the same warning, marked as the CuritibAI's own observation, not the 2024 guide's;
  the `note` says so for the summary and steps 4 and 5.
- Tested: each step 5 sentence that names anonymity or identification carries the 2024-guide hedge or the
  CuritibAI's own marker; step 4 has no sentence that mixes the registration with the CuritibAI's observation.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- No request made, no new network host, no new link, no new dependency.

## 0.78.0 - 2026-11-27

E-mail filter, third pass (the low of the 0.74.0 review). 27 tools. Publishes nothing.

- `city_facilities_search` (every type): a `curitiba.pr.gov.br` address shaped like a person's name is now also
  dropped when a middle word is a single letter ("ana.c.lima", "joao.p.silva", "j.p.silva"), when the surname is an
  initial ("maria.s") and when a separator repeats ("maria..silva", "maria__silva"). A middle initial is any letter
  and needs a last word of two or more letters ("joao.e.silva" too); a final letter is a surname initial when the first
  word and the word just before it have two or more letters ("maria.silva.s", "joao.p.silva.r", "maria.s2",
  "maria.s.2" are dropped; letter codes such as "sme.d.p.e" and "fas.n.s" stay). The unit words are checked first and keep
  the address ("regional.c.cic", "cras..cajuru", "sine.s"); the list is unchanged. Ouvidoria, sine, falecomacgm
  and bare regional names ("boqueirao", "cic") stay; exactly two single letters ("a.b", "a1.b") or a word and a
  number ("sec.2", "sec..2") never match. Tested for each new shape and for the addresses that stay. The local part is at most 64 characters (checked first), so the rule has no long-input cost.
- Known limits: a word and a single letter ("sala.a", "ti.a", "sme.d"), a word, a letter and a number ("sec.e.2")
  and a connector address ("esporte.e.lazer",
  "saude.a.domicilio") are dropped like names, failing closed (none was read); a trailing separator
  ("maria.silva."), two initials at the end ("joao.p.s", read like the letter code "fas.n.s"), a word that starts
  with a number ("2maria.silva", "maria.2silva") and a one-word name ("fulanasilva") still pass.
- Checked against the real records: the 89 urban-equipment layers the tool reads, re-read once on 2026-11-27
  (2,167 records, 1,765 city e-mails, 776 distinct), keep 1,763 e-mails with the old rule and with the first draft
  of this one; none is newly hidden. The final rule drops less than that draft and more than the old rule, so the
  count holds without another read.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- Host contacted only for the check above (`geocuritiba.ippuc.org.br`, already allowed, one request per layer); no
  new network host, no new link, no new dependency.

## 0.77.0 - 2026-11-27

PGV micro-bairro description and the service areas list type (the lows of the 0.73.0 review). 27 tools. Publishes
nothing.

- `place_at_point` `place.pgv`: the `microbairro` description now gives the form the tool returns, "27", and how it is
  made (a number in its JSON form; text of 1 to 6 digits without a trailing ".0"; other text unchanged). It said
  "as published" with the published "27.0" as its example, which the tool has not returned since 0.71.0. No output
  change.
- `place_at_point` `service_areas`: the helper that fills each group's lists takes exactly the lists the group sets
  (`Pick`, not `Partial`), so passing `undefined` for a list no longer type-checks; it would have dropped the key from
  `data`. No output change; the callers are unchanged.
- Tool contract: the `microbairro` description (snapshot updated, one line).
- Citizen eval: no new question; 139 of 143.
- No host contacted, no new network host, no new link, no new dependency.

## 0.76.0 - 2026-11-27

Name filter, third pass (the lows of the 0.72.0 review). 27 tools. Publishes nothing.

- The person-name filters (role lists, person-line tests, the garden allowlist, the service-line words around a hidden
  label) move from `src/sources/geocuritiba.ts` to `src/sources/nameFilter.ts`, in a commit of their own with no
  behaviour change (tests unchanged and green).
- `city_facilities_search` `sine`, `agencia do trabalhador`, `liceu de oficios` and `inss`: a value after
  "Atendimento:" made only of service phrases is shown again, on the same line or after a bare label
  ("Atendimento: por ordem de chegada", "preferencial para idosos", "gratuito", "Carteira de trabalho,
  seguro-desemprego", "gratuito com agendamento"); anything else in the value keeps it hidden ("por ordem de
  chegada. Fulana", "gratuito pela Fulana", "Fulana, gratuito"). Newly hidden: palestrante,
  assistente social and psicólogo/a anywhere in a line ("Palestrante Fulano", "Assistente social Fulana", "Psicóloga
  Fulana de Tal"), and a channel word followed by "da/do/com", or "falar com", and then a word that is not a unit or
  channel word ("Contato no WhatsApp da Fulana", "Contato pelo telefone com Fulana", "Falar com Fulana de Tal").
  "Contato pelo e-mail da unidade", "telefone do Sine", "WhatsApp do CRAS" and "Atendimento psicológico" stay.
- `horta comunitaria`: "e", "com" or "da/do" inside a partner or programme phrase must be followed by an entity,
  place or topic word ("Parceria com a comunidade e a Fulana de Tal" and "Programa Municipal da Fulana" are hidden;
  "Universidade Federal do Paraná", "Secretaria Municipal do Meio Ambiente" and "Programa Municipal de Agricultura
  Urbana e Segurança Alimentar" stay). Known limit, as before: a name after a comma in the phrase ("Parceria com a
  comunidade, Fulana") passes.
- Record for 0.72.0: its rule that an hours line starting with a weekday and holding a digit is never the rest of a
  split name (NOT_A_NAME/WEEKDAY_START) reached every type that hides names line by line: `clube de xadrez`, `cei
  contratado`, `administracao regional`, `cohab`, `mesa solidaria`, `fazenda urbana`, `nucleo de seguranca
  alimentar`, `sine`, `agencia do trabalhador`, `liceu de oficios` and `inss`. Not `horta comunitaria`: its allowlist
  never reads a line as the rest of a name.
- Checked against the real records: layers 150, 151, 149, 152 and 9, re-read once on 2026-11-27 (33 work records and
  56 gardens, 59 with an `observacao`): 0 lines hidden before and 0 after; every record's `hours` is identical. A 50 KB
  input of each new rule's worst shape is tested to run in under a second.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- Host contacted only for the check above (`geocuritiba.ippuc.org.br`, already allowed, one request per layer); no
  new network host, no new link, no new dependency.

## 0.75.0 - 2026-11-27

Ouvidoria anonymity wording (the Security Reviewer's R1-R5 on 0.69.0). 27 tools. Publishes nothing.

- `city_service_guide` (`ouvidoria`): the anonymous denúncia "é registrada" (was "é apurada", which the record of
  the 2024 CGM guide does not say); `what` and step 8 say the anonymous form gets no answer or follow-up and the 30
  days do not apply to it; step 5 says the anonymous form is the 2024 guide's, not checked on the site today.
- Step 4 adds one sentence marked as the CuritibAI's own observation: the anonymous form skips the registration, but
  what the citizen writes or attaches (name, address, phone, a face, photo location, file name) can identify them.
- Tested: each step 5 sentence that names the anonymous form carries the hedge; "apurad" appears nowhere.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- No request made, no new network host, no new link, no new dependency.

## 0.74.0 - 2026-11-27

E-mail filter, second pass (the low of the 0.67.0 review). 27 tools. Publishes nothing.

- `city_facilities_search` (every type): a `curitiba.pr.gov.br` address shaped like a person's name is now also
  dropped when its first word is a single letter ("j.silva"), when a word ends in digits ("maria2.souza",
  "maria.souza2"), when a number closes it ("maria.souza.2", "maria_souza_01") or when the words are joined by "-"
  ("ana-lima"). The unit words are checked first and keep the address ("cras.boqueirao", "cras-cajuru",
  "regional3.cic"); the list is unchanged. A one-word address ("falecomacgm", "sine") or a word and a number
  ("sec.2") never matches. Tested for each new shape and for generic addresses. Known limits: "r.cic" or "sme-dpe"
  would be dropped like names (none was read).
- Checked against the real records: the 89 urban-equipment layers the tool reads, re-read on 2026-11-27 (2,167
  records, 1,765 city e-mails, 776 distinct), keep 1,763 e-mails before and after the change; none is newly hidden.
  None of them has a "-", a one-letter first word or a word ending in digits.
- Not added: a rule for a unit word followed by a name, and sector words such as secretaria, contato or ouvidoria
  in the unit list: they would show "secretaria.fulana", which 0.73.0 hides (both left to Enzo).
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged.
- Host contacted only for the check above (`geocuritiba.ippuc.org.br`, already allowed, one request per layer); no
  new network host, no new link, no new dependency.

## 0.73.0 - 2026-11-27

Service areas helper and PGV text codes, the lows of the 0.66.0 and 0.71.0 reviews. 27 tools. Publishes nothing.

- `place_at_point` `service_areas`: each group (care, safety, registry, civic) now sets only its own lists through one
  helper that fills the others with null; a new group no longer adds a null to every other group. No output change:
  the keys of `data` keep their order (tested for every group), and the answers of the four groups, inside, outside
  Curitiba and with a later layer failing, were compared byte for byte before and after the change.
- `place_at_point` `place.pgv`: a micro-bairro published as text drops a trailing ".0" ("12.0" is "12"), the same
  form a numeric code already had since 0.71.0, so "12.0" and 12 are one row. Only digits (1 to 6) followed by exactly
  ".0" change; other text ("99.1", "99.10", "12.0a") is untouched. Tested.
- Citizen eval: no new question; 139 of 143. Tool contract snapshot unchanged (the `microbairro` description still
  gives the published "27.0" as its example).
- No host contacted, no new network host, no new link, no new dependency.

## 0.72.0 - 2026-11-27

Name filter for the work types, second pass (the lows of the 0.70.0 review). 27 tools. Publishes nothing.

- `city_facilities_search` `sine`, `agencia do trabalhador`, `liceu de oficios` and `inss`: the value of each
  "Atendimento:", "Atendimento ao público:" or "Horário de atendimento:" label at the start of the line or of a
  sentence is kept only when it reads as hours (a digit; "de/das/às" and a digit; a weekday, its abbreviation, "dia"
  or "feriado" that goes on as hours or has a digit later; "diariamente", "presencial", "online"; an appointment, a
  "não é/há …" or a "fechado" sentence), on the same line or, after a bare label (with or without ':'), on the next
  one; otherwise the line is hidden ("Atendimento: Fulana", "Atendimento: Domingos da Silva"). "Local de
  atendimento: Rua …" is not such a label. Docente and facilitador/a (plurals too) hide a line anywhere in it; agente
  and técnico/a before ':', or at the start or after an article or "com/pelo/pela" when a word other than "de", "em",
  "para" … follows: "Técnica Fulana" and "com o agente Fulano" are hidden, "aperfeiçoar técnicas" (layer 149) and "a
  técnica de solda" stay, and "Agentes comunitários" is hidden on the safe side.
- "Contato" is a person unless a channel follows: "Contato: 3350-0000" (only phones, channel words and punctuation
  after the ':', then the end or hours that start with a word: "Contato: 3350-0000 - segunda a sexta 8h") and "contato pelo/via/no 156, telefone, e-mail, site …" stay; "Contato pela Fulana", "Contato via
  Fulano", "Contato: 3350-0000 Fulana" and a bare "Contato:" (its value follows) are hidden. 0.70.0 hid "Contato:
  3350-0000" and kept "Contato pela Fulana". The hours after a contact phone stay, also after a bare "Contato:" and
  its hidden value: an hours line that starts with a weekday and has a digit is never read as the rest of a name (every
  type that hides names). The whole field read joined checks only the words, not what follows a label. Known limit: a
  name later in an hours or channel line ("das 8h às 17h com a Fulana", "contato pelo telefone com Fulana") passes,
  caught only by the role words.
- `horta comunitaria`: a "Parceria com …" or "Programa …" later in the line needs an entity word too ("Horta com 20
  canteiros - Parceria com Fulana" is hidden), and "mantida pela" not followed by an entity word hides the line
  anywhere in it.
  A sentence split was tried and dropped: it missed " - " and ", " and hid public lines with an abbreviation.
- Checked against the layers as read twice on 2026-11-27 (150, 151, 149, 152 and 9, `observacao` only; the second read
  after the review fixes): the new filters changed no record's `hours` against 0.71.0 (78 records with an
  `observacao`). No licence or terms found, as before.
- Citizen eval: q144 ("Onde fica o Liceu de Ofícios mais perto do Portão? (sem expor nome de pessoa)") answered from a
  new synthetic Liceu fixture with a name after "Atendimento:", a contact phone and a docente line. 139 of 143. Tool
  contract snapshot unchanged.
- No new network host, no new link, no new dependency.

## 0.71.0 - 2026-11-27

PGV codes as number or text, a follow-up of the 0.65.0 review. 27 tools. Publishes nothing.

- `place_at_point` `place.pgv`: `microbairro` is read whether the layer publishes `cd_microbairro` as text or as a
  number. A number keeps its JSON form: 27.0 arrives as 27 and is returned as "27" (the ".0" is not invented).
  `microregion` is read from an integer, as before, or from text of 1 to 6 digits ("3" is 3); a blank, "2.5" or other
  text is null, so a blank never becomes the code 0. A
  number below 0 or of 7 digits or more is null for either code (no PGV code is that large). Only these two PGV fields change; the shared field cleaner is
  untouched. Tested.
- Citizen eval: q143 ("Qual a microrregião do IPTU na Rua XV de Novembro, 1000?") answered at a point on that street
  (the tool takes a point, not an address); its synthetic PGV row has a numeric micro-bairro and a text micro-region,
  and the question fails on 0.70.0. 138 of 142. Tool contract snapshot unchanged.
- No host contacted: the layer's field types were not re-read. No new network host, no new link, no new dependency.

## 0.70.0 - 2026-11-27

Name filter for the work types, a follow-up of the 0.64.0 and 0.63.0 reviews. 27 tools. Publishes nothing.

- `city_facilities_search` `sine`, `agencia do trabalhador`, `liceu de oficios` and `inss`: besides a line naming who
  is in charge, a line with professor/a, "Prof.", "Profa." or "Prof.ª", instrutor/a, monitor/a, orientador/a,
  educador/a, tutor/a, atendente or contato (plurals too) anywhere in it is hidden with the same marker, and so is the
  line after such a bare label ("Instrutora:"). "Contato" followed by a channel ("entre em contato pelo 156") stays,
  so the hours after it are not read as the rest of a name. Broader on purpose than a role or a
  label before ':': "Atendimento: atendente Fulana" has the word after the colon. "Atendimento" stays. The other
  office types (regional offices, COHAB, fazenda urbana, núcleos, mesa solidária, chess club) keep the narrower
  filter; tested.
- `horta comunitaria`: a "Parceria com …" or "Programa …" line is a known kind only when a body, an organisation
  (empresa, instituto, universidade, fundação, cooperativa), a public scope (integrado, municipal, estadual, federal)
  or COPEL, Sanepar or Eletrosul follows the keyword (after an optional ':', article or "de"); otherwise it is hidden
  ("Parceria com Fulana", "Programa do Fulano", "Parceria com ONG Fulana"). Generic words a name can follow (projeto,
  ONG, hortas) are left out on purpose. Known limit: a name after an entity word still passes, caught only by the
  person words.
- Checked against the layers as read on 2026-11-27 (150, 151, 149, 152 and 9, `observacao` only): no line named a
  person, and no record's `hours` changed against 0.69.0. No licence or terms found, as before.
- Citizen eval: q142 ("Onde fica o SINE do Pinheirinho? (sem expor nome de pessoa)") answered; the synthetic SINE
  Pinheirinho record gains an attendant line, hidden. 137 of 141. Tool contract snapshot unchanged.
- No new network host, no new link, no new dependency.

## 0.69.0 - 2026-11-27

Ouvidoria anonymity, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_service_guide` (`ouvidoria`): the guide now answers "can I complain without identifying myself?". `what`
  says that for denúncias the 2024 CGM guide gives the anonymous form on the Portal Curitiba Ouve, that this was not
  verified for a plain reclamação, and that e-mail is not an anonymous channel. Step 5 (the CGM e-mail
  `falecomacgm@curitiba.pr.gov.br`) says the sender's address shows in an e-mail, marked as this project's own
  observation, and points at the anonymous form (step 4). Step 6 adds registration as the
  2024 CGM guide gives it (e-Cidadão for the identified and confidential forms, none for the anonymous one), that
  what the site asks today was not verified, and that this project's record of the 2024 guide does not say whether a
  plain reclamação can be anonymous. The `note` says the e-mail fact is this project's own
  observation, not the PDF's. Step numbers and links are unchanged.
- The CGM e-mail spelling matches the 0.43.0 record in docs/sources.md; no page was re-read and no host contacted.
- Citizen eval: q141 ("Posso reclamar na Ouvidoria sem me identificar?") answered by the guide; q140 is left to
  0.68.0 (PR #83). 136 of 140. The eval checks shape only; the anonymity text is guarded by
  `test/cityServiceGuide.test.ts`.
- Version 0.69.0: 0.68.0 was taken by PR #83 (annual procurement plan), open when this was written.
- No new network host, no new link, no new dependency.

## 0.67.0 - 2026-11-27

Neighbourhood culture and reading, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type`s from IPPUC's GeoCuritiba urban-equipment layers, read on 2026-11-27:
  `casa da leitura` (layer 61, 17 records; aliases include `casa de leitura`), `bondinho da leitura` (60, 1),
  `auditorio` (52, 26), `circo` (57, 2) and `clube de xadrez` (58, 1; alias `xadrez`). Address, hours and public
  contacts as published. `auditorio` lists private, state and federal auditoriums too, so it carries the mixed-ownership
  note of museu and teatro. When read, one auditorium and the chess club published a city e-mail shaped like a
  person's name: a new type option `noEmails` returns no e-mail for `auditorio` and `clube de xadrez`, their notes
  say to call. The chess club uses the offices' person-line filter; auditorio does not, since that filter would hide
  the real "Atendimento Secretaria:" hours of two records and no auditorium line named anyone. The Casa da Leitura note says not every bairro has one and points at `farol do saber` and `biblioteca`.
- E-mails, every `city_facilities_search` type: a `curitiba.pr.gov.br` address whose local part is two or more
  alphabetic words joined by "." or "_" (shaped like "nome.sobrenome") is dropped as a person's own, unless the first
  word names a unit (`cras`, `visa`, `ccz`, `us`, `cmei` and others listed in docs/sources.md).
- Tool contract: the `type` description (snapshot updated).
- Citizen eval: q139 ("Tem Casa da Leitura perto do Bairro Alto?") answered. In the live read the nearest Casa da
  Leitura is about 3.7 km from Bairro Alto, beyond the 3 km `near` limit, so the honest answer is none within 3 km
  (`not_found`) and the note names the other reading places; the synthetic fixture keeps every record beyond 3 km;
  135 of 139.
- No new network host, no new link, no new dependency.

## 0.66.0 - 2026-11-26

Electoral zone at a point, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `place_at_point` `service_areas`: new `areas` value `civic`. It reads IPPUC's GeoCuritiba thematic layer 13 (Zona
  Eleitoral, 10 zones, read on 2026-11-27 UTC) and returns `electoral_zones` (`zone`, `polling_places`, `sections`,
  `reference_date`): the zone as published, its counts of voting places and sections as whole numbers (null when not
  one) and `data_alteracao`. 1 request cold, 2 when no zone contains the point (the bairro layer then decides
  `inside_curitiba`). Only `zona_eleitoral`, `num_locais`, `num_secoes` and `data_alteracao` are requested; never
  `num_eleitores`, the same rule as the voting places. The note says the zone covers the point and is not necessarily
  where a person votes (their título de eleitor says that), that a bairro can span more than one zone, and points to
  `city_facilities_search` `local de votacao`.
- `all` stays care and safety: a cold `all` already uses the 5 requests of the call budget.
- Tool contract: the `areas` enum and description, the new nullable list `electoral_zones`, and the tool description
  ("If partial, call again." replaces "Cold calls may be partial: retry.", to stay within 400 characters) (snapshot
  updated).
- Citizen eval: q138 ("Qual zona eleitoral cobre o Boqueirão?") answered, with a synthetic fixture; 134 of 138.
- No new network host, no new link, no new dependency.

## 0.65.0 - 2026-11-26

IPTU Planta Genérica de Valores micro-region at a point, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `place_at_point` part `place`: new field `pgv`, the PGV 2025 micro-region that contains the point, from IPPUC's
  GeoCuritiba `Publico_GeoCuritiba_Planta_Generica_Valores` layer 0 (1,062 polygons, read on 2026-11-26):
  `micro_regions` with `zone_code`, `zone_name`, `bairro`, `microbairro` and `microregion` as published (distinct, at
  most 5; 0 is a code), and `source_url`. One more point query, read last so the call budget cuts it first; a failure
  leaves `pgv` null and the part `partial`. The note says the micro-region is not a property value or an IPTU amount.
  `vukt` and `cod_vukt` (a land unit value with no published unit or use) are never requested, and no lot is read.
- The missing-layers note lists several layers ("the zoning, street and PGV layers").
- Tool contract: the description, the `place` part and its `pgv` field (snapshot updated).
- Citizen eval: q137 ("Em qual microrregião da Planta Genérica de Valores do IPTU fica o Portão?") answered, with a
  synthetic fixture; 133 of 137.
- No new network host, no new link, no new dependency.

## 0.64.0 - 2026-11-26

Work services, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type`s from IPPUC's GeoCuritiba urban-equipment layers, read on 2026-11-26: `sine`
  (layer 150, 12 records; aliases include `sine municipal`, `unidades do sine`), `agencia do trabalhador` (151, 1),
  `liceu de oficios` (149, 16; aliases `liceu`, `liceus`) and `inss` (152, 4; aliases `agencia do inss`, `agencia da
  previdencia social`). Address, hours and public contacts as published, with the offices' person-line filter. The
  SINE note says units are named after their Rua da Cidadania, not always the bairro, so search by `name`
  ("pinheirinho"); that when read the layer published no address for the SINE Móvel, which moves daily; and that vacancies and anyone's
  registration are not in this tool. When read, the Agência do Trabalhador's e-mail was not a city address and was not shown. A
  Liceu hours line over 160 characters is split at commas, not cut. The INSS lead note says it is a federal service
  whose benefits and appointments go through Meu INSS or the 135 (named, not linked) and that the tool does not
  book; the 135 is kept in `phones`.
- Tool contract: the `type` description (snapshot updated).
- Citizen eval: q136 ("Onde tem SINE perto do Pinheirinho?") answered, with a synthetic fixture; 132 of 136.
- No new network host, no new link, no new dependency.

## 0.63.0 - 2026-11-26

The community-garden line filter becomes an allowlist, a follow-up of the 0.61.0 and 0.62.0 reviews. 27 tools.
Publishes nothing.

- `city_facilities_search` `horta comunitaria`: a line in `hours` is shown only when it is a known public kind: a
  public label (atendimento, horário, funcionamento, endereço, bairro, pomar, cultivo, área de plantio or lavoura,
  jardins de mel), an hours or number line (a digit or a weekday, after an optional hours label and "de", "das" or
  "aos"; "Horário de funcionamento:", "Sábados"), the body that keeps
  or runs the garden ("Mantida pela Associação …", "A SMSAN coordena …"), the city programme, a partner ("Parceria com
  …"), "Horta com N canteiros", or exactly "Contato pelo e-mail da secretaria". A known kind with a person in it (a
  contact, a volunteer, an honorific, a name before "cuida", in any case) is still hidden. Any other line is hidden
  with the same marker as before. Three rules replace eight.
- Fixed: a lower-case name passed ("maria cuida da horta", "Pomar: dona maria"); it is hidden now. Fixed: the hours
  line after "Contato pelo e-mail da secretaria." ("Atendimento 8h às 17h") hid the whole field; both lines stay now.
  The whole-field test (a keyword split across lines) and the split-name tail rule are skipped for an allowlist,
  where each line is already judged, so a public line after a hidden one stays. "Secretária Fulana" is read as a
  person, not the body "secretaria".
- Known limits, as before: a name in the rest of a line that starts as a known kind ("Parceria com …", a label's
  value) is caught only by the person words above; a public sentence wrapped onto a second line loses the second
  line (hidden, never shown).
- Behaviour change on purpose: free text of no known kind ("Horta bonita perto da praça") is now hidden. Run over the
  56 community gardens as read on 2026-11-26 (26 with an `observacao`), no line is hidden.
- `src/sources/geocuritiba.ts`: social-assistance types carry an explicit `shelter` flag, and the garden an
  `allowlist` flag, in place of a check on which filter function a type uses (two places in `equipmentRecord`).
  Tests pin which types carry each flag.
- Tests: each allowlisted kind, alone and all in one field; hours after the secretariat e-mail line; lower-case names;
  an unknown line. "Titular da conta" (an office line) is now checked against the office person filter, which keeps
  it; the garden allowlist hides it. Tool contract snapshot unchanged. Citizen eval 131 of 135, as in 0.62.0.
- No new network host, no new dependency.

## 0.62.0 - 2026-11-26

A simpler text key and line filter, the follow-ups of the 0.60.1 review. 27 tools. Publishes nothing. No tool, input,
output, note or error changes.

- `src/text.ts`: one `foldKey()` (folded, every run of non-letters and non-digits one space, trimmed) replaces five
  copies of the same one-line key in `geocuritiba`, `linhaTurismo`, `city_facilities_search`, `river_levels` and
  `guaira_events`, and a sixth in a test.
- `src/sources/geocuritiba.ts`: one `roleFold()` reads "secretária" as the role for both the office person-line test
  and the CEI service-line tests, in place of two folds that differed only in their regex.
- `hourLines` no longer decides by which filter function a type uses: the type carries an explicit `nameLines` flag
  (`maintainer` for contracted CEIs; `person` for the offices, Mesa Solidária, community gardens, Fazenda Urbana and
  the food-security núcleos). A test pins which types carry it and that the flag, not the function, turns on the
  split-name and label rules.
- `city_facilities_search`: the `name` check is written once for the Linha Turismo and the layer paths; a new test
  pins which error wins when several arguments are wrong (unchanged).
- Source: 56 lines removed, 57 added (5 of them the flag's doc comment); tests: 22 removed, 60 added (the two pins
  and `foldKey` cases). Tool contract snapshot unchanged. Citizen eval 131 of 135, as in 0.61.0.
- No new network host, no new dependency; docs/sources.md unchanged.

## 0.61.0 - 2026-11-26

Community-garden person lines, a follow-up of the 0.60.0 review. 27 tools. Publishes nothing.

- `city_facilities_search` `horta comunitaria`: a line naming who cares for or coordinates a garden is now hidden
  too: "quem cuida" or "quem coordena" ("Quem cuida: Fulana", and the name on the line after "Quem cuida:");
  "coordenado/a" or "cuidado/a" por, pelo or pela ("Coordenada por Fulana", "Cuidada pela Dona Maria"), unless a body
  follows ("Coordenada pela Associação …", "Cuidada pela comunidade" stay); a capitalised word right before cuida,
  cuidam, coordena or coordenam, also after ", que" ("Dona Maria cuida da horta"; "A Associação de Moradores cuida"
  and an acronym stay); and Dona, Seu, Sr(a). or Senhor(a) before a capitalised word, anywhere in the line.
- The labels whose capitalised value stays visible are an allowlist that gains bairro, pomar and cultivo(s):
  "-Pomar: Citrus e banana", "Cultivo: Hortaliças" and "Bairro: Centro" are shown; any other one-word label followed
  by a capitalised word is still hidden ("Canteiro: Dona Maria"). "Contato pelo e-mail da secretaria" is shown unless
  ':' or a name follows it, on its line or on the next one; any other line with "contato" is still hidden.
- No tool, input, output or note change; tool contract snapshot unchanged. Citizen eval 131 of 135, as in 0.60.1.
- No new network host, no new dependency; docs/sources.md, docs/tools.md and SPEC.md describe the new lines.

## 0.60.1 - 2026-11-26

A simpler `city_facilities_search` source after twenty feature releases (0.41.0 to 0.60.0). 27 tools. Publishes
nothing. No tool, input, output, note or error changes: every type's output is byte-identical to 0.60.0.

- `src/sources/geocuritiba.ts`: one `facility(name, fields)` builder gives every record its 17 fields in output order,
  in place of five full literals (equipment, private address, voting, park, bike); the Linha Turismo items in
  `src/tools/cityFacilitiesSearch.ts` use it too, and one `item()` drops the internal `paths` for both.
- `FACILITY_TYPES`: each entry passes its options to `equipment()` instead of spreading it and overriding fields; the
  `mixed` flag is the `mixedOwnership` option; the shelter and person-in-charge line filters are one shared option
  each (`HIDE_SHELTER`, `HIDE_PERSON`) instead of the same two fields repeated.
- 301 lines removed and 155 added in `src/`. Pinned by a script outside the repository that ran every type against
  every GeoCuritiba fixture (22,200 outputs, `parseLayer` and `facilitiesResult`, plus the type list and Linha Turismo
  results) before and after: same SHA-1. Tool contract snapshot unchanged; citizen eval 131 of 135, as in 0.60.0.
- No new network host, no new dependency; docs/sources.md is unchanged.

## 0.60.0 - 2026-11-26

Food security, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type`s from IPPUC's GeoCuritiba urban-equipment layers, read on 2026-11-26:
  `mesa solidaria` (layer 7, 4 places; aliases `mesas solidarias`, `mesa solidaria curitiba`), `horta comunitaria`
  (layer 9, its 56 community gardens; aliases include `hortas comunitarias`, `horta urbana`), `fazenda urbana` (layer
  10, 3 farms; alias `fazendas urbanas`) and `nucleo de seguranca alimentar` (layer 1, 10 núcleos; aliases include
  `nucleo regional de seguranca alimentar`). Address, hours and contacts as published.
- `horta comunitaria` asks the layer for `tipo_equi = 'Horta Comunitária Urbana'` only (a fixed `where`, never user
  input): the layer's 109 school and 68 institutional gardens are inside schools and institutions, some of them
  shelters, and are never listed. The note gives those counts and says the gardens had no phone and no hours when
  read, only the layer's e-mail, and that `source_url` is the whole layer.
- `mesa solidaria` splits long hours lines at commas, so no serving time is cut. The note says some places only cook
  and list no serving hours, and that the phone is published as a WhatsApp line. The `fazenda urbana` note says
  mobiles are dropped (use the e-mail) and the tool does not enrol; the `nucleo de seguranca alimentar` note says
  programmes, benefits and registration are not in this tool.
- `phones` (every `city_facilities_search` type): a leading "WhatsApp", "Whats" or "Zap" word is removed before the landline test, so
  "WhatsApp (41) 3350-3821" is kept; it was dropped before. WhatsApp mobiles are still dropped.
- Person lines (v0.59 review): the four new types use the office filter, whose roles gain secretário/a, supervisor/a
  and gestor/a; titular, coordenação and gestão before ':'; and "mantido/a por" anywhere or "mantida pelo Sr./Sra./
  Dona" ("Secretaria Municipal de …", "Titular da conta" and "mantida pela Associação …" stay). For `cei contratado`
  the line after a hidden "…:" label is hidden only when it is not an hours or service line: "Responsável pela
  matrícula:" no longer hides "-2ª a 6ª" or "Período parcial", and a long name after "Diretora responsável:" is still
  hidden. `horta comunitaria` also hides a line with "contato" anywhere, "voluntário/a" or "cuidado/a por", and a one-word label followed by ':' and a capitalised word ("Contato: Dona Maria", "Zeladora: Fulana"; not the atendimento, horário, funcionamento or endereço labels). One service word list serves the CEI tests, so
  "Matrículas abertas em janeiro" and "Secretaria da escola" stay after a hidden maintainer line. No line was hidden in
  the live layers.
- Tool contract: the `type` description (snapshot updated).
- Citizen eval: q135 ("Onde tem Mesa Solidária no Centro?") added and answered, with a synthetic fixture; 131 of 135.
- No new network host, no new dependency, and no link added by the code. The `fazenda urbana` hours carry, as
  published text, two city pages for enrolment (`guia.curitiba.pr.gov.br`, `aprendere.curitiba.pr.gov.br`); the server
  never fetches them.

## 0.59.0 - 2026-11-26

COHAB agencies, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type` `cohab` from IPPUC's GeoCuritiba urban-equipment layer 29 (9 records on
  2026-11-26; aliases include `cohab ct`, `agencia da cohab`, `agencias da cohab`). Address, hours and contacts as
  published. The note says every agency listed the same phones and e-mail (central contacts), that the layer books
  in-person service through the Agenda Online and this tool does not book (`city_service_guide` `agenda_online`),
  that housing applications, the applicant queue and anyone's registration are not in this tool, and to search by
  `name`, since agencies are named after their Rua da Cidadania, not always their bairro.
- `phones` (every `city_facilities_search` type) now keeps toll-free numbers, formatted "0800 XXX XXXX" (or
  "0800 XXX XXX"); they were
  dropped before. A toll-free number is never a person's own; mobiles and other area codes are still dropped.
- `administracao regional` and `cohab`: a `hours` line that starts with who is in charge or has "<role>:"
  ("Responsável: Fulana", "Administrador Regional:", "Diretor(a):"), and the name on the line after such a label, is
  replaced by a marker (v0.58 review). It reuses the `cei contratado` label handling with a narrower word list, so an
  office line about MEI or "o responsável" stays. The CEI word list gains `administrador`. No such line was in the
  live layers.
- Tool contract: the `type` description and the `phones` description (snapshot updated); the general note says phones
  keep 0800 numbers.
- Citizen eval: q134 ("Onde fica a agência da COHAB no Tatuquara e que horas abre?") answered, with a synthetic
  fixture; 130 of 134.
- No new network host, no new link, no new dependency.

## 0.58.0 - 2026-11-26

Rodoferroviária and administrações regionais, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type`s from IPPUC's GeoCuritiba urban-equipment layers (records on 2026-11-26):
  `rodoviaria` (159, 1; aliases include `rodoferroviaria`, `terminal rodoviario`), `ferroviaria` (160, 1; aliases
  include `terminal ferroviario`, `estacao ferroviaria`) and `administracao regional` (15, 10; aliases include
  `administracoes regionais`, `sede da regional`). No
  bare `regional`, `terminal` (still the urban bus terminals) or `trem`. Hours, address and landlines as published.
- `rodoviaria` note: the hours are the terminal's, not departures; intercity departures, platforms and fares are not in
  this tool (the bus company, the terminal or the URBS home page, the link the bus tools already return).
  `ferroviaria` note: hours by season as published, the layer does not say which season applies; the operator's
  e-mail is dropped by the unchanged filter; no train times or tickets. `administracao regional`: long bairro lines are
  split, not cut; `bairro` filters by where the office is, not the bairros it serves.
- Tool contract: the `type` description (snapshot updated).
- Citizen eval: q133 ("Qual o endereço e o horário da Rodoferroviária de Curitiba?") answered, with a synthetic
  fixture; 129 of 133.
- No new network host, no new link, no new dependency.

## 0.57.0 - 2026-11-26

Registry areas at a point, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `place_at_point` `service_areas`: new `areas` value `registry`. It reads IPPUC's GeoCuritiba thematic layers 15
  (Circunscrição Imobiliária, 12 areas) and 16 (Registro Civil, 19 areas) and returns `property_registry`
  (`circumscription`, `legal_basis`) and `civil_registry` (`service`, `legal_basis`), `legal_basis` being `fonte` as
  published. 2 requests cold. Only `circunscricao`, `servicos` and `fonte` are requested; never `nome` or the editor
  fields `created_user` and `last_edited_user`. The note says the areas may have changed, name the registry and not its
  address, do not replace a certidão, and points to `city_facilities_search` `cartorio de registro civil`.
- `all` stays care and safety: a cold `all` already uses the 5 requests of the call budget.
- Tool contract: the `areas` enum and description, two new nullable lists (snapshot updated).
- Citizen eval: q132 ("Qual cartório de registro de imóveis atende uma casa no Batel?") answered; 128 of 132.
- No new network host, no new link, no new dependency.

## 0.56.0 - 2026-11-26

Smaller package, same behaviour. 27 tools. Publishes nothing.

- Build: `removeComments` in `tsconfig.build.json`. Packed size 251,583 to 211,163 bytes (`scripts/check-pack.mjs`).
- The ODbL notice of `dist/sources/osmBundled.js` is a `/*!` block, kept by the build; the package check fails if it,
  or the OSM and URBS attribution strings, leave the packed files. No contract change. Eval: 127 of 131, unchanged.

## 0.55.0 - 2026-11-26

Follow-up of the 0.54.0 review. 27 tools. Publishes nothing.

- `cei contratado`: after a hidden maintainer line, an Av., Fone, Período, Vagas or Berçário line stays visible;
  short service words match whole words, so a split surname ("Ruas Telles") is still hidden. Eval: 127 of 131, unchanged.

## 0.54.0 - 2026-11-26

Hardens the `cei contratado` maintainer filter from 0.53.0. 27 tools. Publishes nothing.

- `cei contratado`: the marker also replaces "Mantida pela/pelo", "MEI", "Responsável" and "Diretora" lines, a bare
  label without ":" and the line after it, and one more line of a split name (a third stays visible). Hide only.
- No contract change, no new host or link. Eval: 127 of 131, unchanged.

## 0.53.0 - 2026-11-26

Municipal schools, CMEIs, CMAEEs and contracted CEIs, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type`s from IPPUC's GeoCuritiba layers (records on 2026-11-26): `escola municipal`
  (80, 188), `cmei` (78, 241; alias `creche municipal`), `cmaee` (81, 13) and `cei contratado` (79, 180; alias
  `creche contratada`). No bare `escola` or `creche`. Escolas rarely publish hours; the note says to call.
- `cei contratado`: a line naming the maintainer (some are a person) is replaced by a marker; the note says a
  contracted CEI is not a confirmed Vale-Creche accreditation and points to `city_service_guide` `vale_creche`.
- Contract: `type` description. No new host or link. Eval: q131 answered; 127 of 131.

## 0.52.0 - 2026-11-26

Social assistance beyond the CRAS, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type`s from IPPUC's GeoCuritiba layers (records on 2026-11-26): `creas` (38, 10),
  `centro pop` (40, 3), `central de encaminhamento social` (39, 1), `centro de atividades para idosos` (36, 5; alias
  `espaco conviver`), `centro de referencia da mulher` (108, 2; alias `casa da mulher brasileira`) and `centro de
  referencia afro` (109, 1). Same fields, host gate, cache and contact filters as the other layers. The CREAS note says
  which bairros a unit serves is not in the layer. No note promises service, eligibility or free care.
- Shelters and transit houses (layers 45, 46, 164) are never types; no `abrigo`, `casa de passagem` or `acolhimento`
  name resolves (tested). One Centro POP record named a transit house's address: in the six types and `cras`, a line
  that may point at a shelter or a confidential unit is replaced by a marker, even past the 160-character cut
  (`isShelterLine`, linear), and a record whose name or address does is skipped.
- Women's centres: when `divulgar_endereco` is not exactly "Sim", only the name, institutional phones and a line saying
  to call are returned, so `bairro` and `near` never match (new optional `privateAddress`; tested with "Sim", "Não",
  null and "sim"). The note leads with 190 and 180, as on the Ministério das Mulheres' Ligue 180 page (`www.gov.br`,
  read by hand; never contacted by the server), and says the tool does not dispatch help.
- Contract: `type` and `skipped_records` descriptions. No new server host or link. Eval: q130 answered; 126 of 130.
- Package check: the packed-size ceiling is raised once, from 250,000 to 252,000 bytes (CI packed this release at
  250,367; Enzo's decision, 2026-11-25). It is not to be raised again: on the next overflow, trim what the package ships.

## 0.51.0 - 2026-11-26

Cartórios de registro civil, Junta Militar, Defensoria Pública and fóruns, phase B of the 1.0 roadmap. 27 tools.
Publishes nothing.

- `city_facilities_search`: new `type`s, read live from IPPUC's GeoCuritiba urban-equipment layers with the same
  fields, filters, host gate, cache and phone and e-mail allowlist as the other layers (records when read on
  2026-11-26 UTC in brackets):
  - `cartorio de registro civil` (layer 99, 4 records; aliases `cartorios de registro civil`, `registro civil`,
    `cartorio de registro civil das pessoas naturais`, `cartorios de registro civil das pessoas naturais`,
    `certidao de nascimento`, `certidao de casamento`, `certidao de obito`);
  - `junta militar` (layer 21, 3; aliases `juntas militares`, `junta de servico militar`, `juntas de servico militar`,
    `alistamento militar`);
  - `defensoria publica` (layer 105, 14; aliases `defensoria`, `defensorias`, `defensorias publicas`,
    `defensoria publica do parana`, `defensoria publica do estado`);
  - `forum` (layer 106, 9; alias `foruns`).
  No bare `cartorio`, `certidao`, `junta`, `justica` or `tribunal` alias; none of the new names was used by another
  type.
- Notes: the registry note says these are the offices IPPUC's layer lists, as published, not necessarily every registry
  office in Curitiba, and that prices, deadlines and which office holds a given record are not in the layer, so call
  the office before going. The junta, Defensoria and fórum notes say `bairro` filters by where an office is, not by
  the bairros it serves (those are in `hours`). The Defensoria note says who can be assisted is not in the layer, that
  a post can come back with no phone, and to reach the Defensoria Pública do Paraná through its own channels (not
  linked). No note names a price, free service or a same-day document (tested).
- Each registry record ends with "Cartório <surname>." (the office's trade name after a person): in `hours`, any line that mentions "cartório" (any case, anywhere) is replaced by the marker "[a line about the cartório is not shown: it can carry a person's name or a notice; ask the office]" (new optional `hideLine`; a plain substring regex, linear, replacing the exponential one of the first review round; consecutive markers merged), so no surname is shown and nothing is cut silently; a notice that mentions the cartório ("Cartório Fechado.", "Cartório de plantão aos sábados, das 9h às 12h.") is hidden the same visible way. When read, only the trade-name lines mentioned it (tested, also for speed on long ambiguous lines). The bairro lists of the juntas, Defensoria posts and fóruns run
  to about 500 characters: for these types a line over 160 characters is split after its commas into several lines
  instead of being cut with "…" (new optional `wrapLines`; also after semicolons). Other types are unchanged.
- Privacy filters unchanged: the registry offices' own-domain e-mails (one with a person's name), the Defensoria's
  `defensoria.pr.def.br` and gmail addresses and its mobile numbers (8 of 14 posts; two publish only a mobile and come
  back with no phone), and the Justiça do Trabalho's `trt9.jus.br` address are dropped; synthetic fixtures with a
  personal-name e-mail, a gmail and mobiles prove it per type. The juntas' `curitiba.pr.gov.br` unit mailboxes are
  kept.
- The `type` parameter description names the four types (snapshot updated); the tool descriptions are unchanged.
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-26.
  Nine hand requests to it that day (robots.txt, one whole-layer read and the metadata of each layer), recorded in
  [docs/sources.md](docs/sources.md). The link allowlist is unchanged.
- Citizen eval: new q129 ("Onde tiro a segunda via da certidão de nascimento no Centro?") answered by
  `city_facilities_search` `cartorio de registro civil` with `bairro`, on a synthetic fixture: the office's name,
  address, hours, phone and the note. 125 of 129 answered. The Curitiba App table has no row for these services and is
  unchanged.

## 0.50.0 - 2026-11-25

Where to get an RG (Instituto de Identificação), phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type` `instituto de identificacao` (aliases `instituto de identificacao do parana`,
  `rg`, `carteira de identidade`, `carteira de identidade nacional`, `posto de identificacao`, `postos de identificacao`), read live from IPPUC's
  GeoCuritiba urban-equipment layer 168 "Instituto de Identificação do Paraná" with the same fields, filters, host
  gate, cache and phone and e-mail allowlist as the other layers (12 records when read on 2026-11-25: the head office,
  the Central post, nine posts in Ruas da Cidadania and one in a shopping centre). No bare `identidade`, `documento` or
  `cin` alias; none of the new aliases was used by another type.
- The layer has no appointment field: the line "Necessário agendamento prévio para atendimento." (11 of 12 records)
  is part of the published text and comes back in `hours`, with the days and hours, as published; "2ª e 6ª feira"
  (three posts) is kept as written. The note starts "Appointments are booked through the Paraná state Instituto de
  Identificação's channels (not linked by this tool); this tool lists places, it does not book." and says that a
  record with no appointment line does not mean no appointment is needed, that the head office's hours are
  administrative, to call before going, that `open_periods` (periods of the day) and `hours` do not always agree, and that most posts are named after their Rua da Cidadania, not always the bairro
  (filter by `bairro` or `near`). The state booking page is not linked (state host, not on the link allowlist).
- E-mails: the layer publishes `ii.pr.gov.br` addresses; the e-mail allowlist (`curitiba.pr.gov.br` only) is
  unchanged, so `emails` is empty for every record. Phones are Curitiba landlines and are kept.
- The `type` parameter description names `instituto de identificacao` (or `rg`) (snapshot updated); the tool
  descriptions are unchanged.
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Three hand requests to it that day (robots.txt, the layer's metadata and one whole-layer read), recorded in
  [docs/sources.md](docs/sources.md). The link allowlist is unchanged.
- Citizen eval: new q128 ("Onde eu faço a carteira de identidade no Tatuquara e precisa agendar?") answered by
  `city_facilities_search` `rg` with `bairro`, on a synthetic fixture: the post's name, address, days and hours, the
  appointment line, phone and the note. 124 of 128 answered. The Curitiba App table has no row for identity documents
  and is unchanged.

## 0.49.0 - 2026-11-25

Police stations with hours, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: four new `type`s read live from IPPUC's GeoCuritiba urban-equipment layers, with the same
  fields, filters, host gate, cache and phone and e-mail allowlist as the other layers: `delegacia` (aliases
  `delegacias`, `delegacia de policia`, `delegacias de policia`, `delegacia da policia civil`, `delegacias da policia
  civil`, `policia civil`, `distrito policial`, `distritos policiais`), layer 143 "Polícia Civil" (49 units when read
  on 2026-11-25: the 13 district delegacias, specialised delegacias, the Centros Integrados de Atendimento ao Cidadão
  and divisions and support units); `policia federal` (alias `superintendencia da policia federal`), layer 146 (1
  record); `policia rodoviaria federal` (aliases `prf`, `superintendencia da policia rodoviaria federal`), layer 147 (1
  record); `policia cientifica` (aliases `policia cientifica do parana`, `unidade de execucao tecnico cientifica`,
  `unidades de execucao tecnico cientifica`), layer 145 (3 records). No bare `policia`, `pf`, `dp` or `iml` alias.
- Every note for these types starts "Emergency: call 190 (Polícia Militar), 197 (Polícia Civil) or 191 (Polícia
  Rodoviária Federal). This tool lists places, it does not file police reports." All three numbers are in the
  "Emergências" section of the Instituto Municipal de Turismo's "Telefones Úteis" page as read on 2026-11-22 (not read
  again). The `delegacia` note says being listed does not mean a unit takes reports from the public (call before
  going), that district delegacias are named by number (filter by `bairro`, not `name`), that the 24-hour flag and `hours` do not always agree, names the Polícia Civil do Paraná's Delegacia
  Eletrônica for online reports without a link (no Polícia Civil host is on the link allowlist) and points to
  `places_search` for Polícia Militar units.
- E-mails: the layers publish `pc.pr.gov.br`, `pf.gov.br` and `prf.gov.br` addresses; the e-mail allowlist
  (`curitiba.pr.gov.br` only) and the phone allowlist are unchanged, so `emails` is empty for every police record.
- Descriptions: `places_search` now says to prefer it only for fire and Polícia Militar stations or when other tools
  find nothing, and points to `city_facilities_search` for delegacias; `city_facilities_search` names delegacias, and its
  `type` description names the four types and points to `places_search` for fire stations and Polícia Militar units
  (snapshot updated). `places_search` and its bundled OSM police list are unchanged otherwise.
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Nine hand requests to it that day (robots.txt, one whole-layer read and the metadata of each layer), recorded in
  [docs/sources.md](docs/sources.md). The link allowlist is unchanged.
- Citizen eval: new q127 ("Qual o endereço e o horário da delegacia do Tatuquara?") answered by
  `city_facilities_search` `delegacia` with `bairro`, on a synthetic fixture: the delegacia's name, address, hours,
  phone and the note. q035 ("Onde ficam as delegacias de polícia em Curitiba?") moves from `places_search` to
  `city_facilities_search` `delegacia`, the route the new descriptions give. 123 of 127 answered. The Curitiba App table has no row for these places and is unchanged.

## 0.48.0 - 2026-11-25

Guarda Municipal modules and regional núcleos, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: two new `type`s read live from IPPUC's GeoCuritiba urban-equipment layers, with the same
  fields, filters, host gate, cache and phone and e-mail allowlist as the other layers: `modulo da guarda` (aliases
  `modulos da guarda`, `modulo da guarda municipal`, `modulos da guarda municipal`), layer 139 (40 modules when read
  on 2026-11-25, most "Diariamente, 24 horas"); `nucleo da guarda` (aliases `nucleos da guarda`, `nucleo da guarda
  municipal`, `nucleos da guarda municipal`, `nucleo regional da guarda municipal`, `nucleos regionais da guarda
  municipal`, `nucleo regional da defesa social`, `nucleos regionais da defesa social`), layer 138 (10 regional
  núcleos, named Núcleo Regional da Defesa Social in the layer, with operational and administrative hours and the
  bairros each covers in `hours`). No bare `guarda`, `guarda municipal`, `seguranca`, `policia`, `modulo` or `nucleo`
  alias.
- Every note for these types starts "Emergency: call 153 (Guarda Municipal) or 190 (Polícia Militar). This tool lists
  places, it does not dispatch help." 153 is in the layers' text; 153 and 190 are in the "Emergências" section of the
  Instituto Municipal de Turismo's "Telefones Úteis" page as read on 2026-11-22. The module note says a place with no
  module may still be patrolled and that a phone of 153 is the Guarda's emergency line, not the module's own (11
  modules publish 153 as their `telefone`; it is kept, as a three-digit public number). The núcleo note says `bairro`
  filters by where the núcleo is: the bairros it covers are only in its `hours`. The `type`
  description names the new types (snapshot updated).
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Five hand requests to it that day (robots.txt, one whole-layer read and the metadata of each layer), recorded in
  [docs/sources.md](docs/sources.md). The link allowlist is unchanged.
- Citizen eval: new q126 ("Tem módulo da Guarda Municipal no Parque Tanguá?") answered by `city_facilities_search`
  `modulo da guarda` with `name`, on a synthetic fixture: the module's address, hours, 24-hour flag and phone. 122 of
  126 answered. The Curitiba App table has no row for these places and is unchanged.

## 0.47.0 - 2026-11-25

Health surveillance, zoonoses and the municipal veterinary hospital, phase B of the 1.0 roadmap. 27 tools. Publishes
nothing.

- `city_facilities_search`: three new `type`s read live from IPPUC's GeoCuritiba urban-equipment layers, with the
  same fields, filters, host gate, cache and phone and e-mail allowlist as the other layers: `vigilancia sanitaria`
  (aliases `vigilancias sanitarias`, `vigilancia sanitaria municipal`), layer 167 (10 offices of the Secretaria
  Municipal da Saúde when read on 2026-11-25, one per regional, Monday to Friday 8h to 18h); `zoonoses` (aliases
  `centro de controle de zoonoses`, `centro de controle de zoonoses e vetores`, `controle de zoonoses`, `centro de
  zoonoses`, `centros de zoonoses`, `zoonose`, `centro de zoonose`, `ccz`), layer 136 (1 record: the Centro de
  Controle de Zoonoses e Vetores, daily hours and a weekend and holiday on-duty line, as published); `hospital veterinario` (aliases `hospital veterinario municipal`, `hospitais
  veterinarios`), layer 112 (1 record: the Hospital Veterinário Municipal, address only). No bare `vigilancia`,
  `veterinario`, `animal` or `pet` alias.
- Notes say only what the layers publish. `vigilancia sanitaria` and `zoonoses`: hours as published, call before
  going or the 156. `hospital veterinario`: when read on 2026-11-25 the layer published the address only (no hours,
  phone, services or who it serves); empty `hours` or `phones` and all-false `open_periods` mean not published, not
  closed; the tool cannot say who the hospital serves or what it costs: ask the 156. No free care is promised. The `type` description names the new types (snapshot
  updated).
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Ten hand requests to it that day (robots.txt, three reads on a wrong path answered "Service not found", one
  whole-layer read and the metadata of each layer), recorded in [docs/sources.md](docs/sources.md). The link
  allowlist is unchanged.
- Citizen eval: new q125 ("Onde fica o Hospital Veterinário Municipal e como funciona?") answered by
  `city_facilities_search` `hospital veterinario`, on a synthetic fixture: the address, and a note that says how it
  works is not published. 121 of 125 answered. The Curitiba App table has no row for these services and is unchanged.

## 0.46.0 - 2026-11-25

CAPS and specialty centres with hours, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: three new `type`s read live from IPPUC's GeoCuritiba urban-equipment layers, with the
  same fields, filters, host gate, cache and phone and e-mail allowlist as the other layers: `caps` (aliases `centro
  de atencao psicossocial`, `centros de atencao psicossocial`), layer 135 "Centro de Atenção Psicossocial" (13 CAPS
  when read on 2026-11-25, 9 of them "Diariamente, 24 horas", the others from 7h to 19h); `centro de especialidades
  medicas` (aliases `centros de especialidades medicas`, `especialidades medicas`), layer 132 (10 municipal and state
  centres, Monday to Friday); `centro de especialidades odontologicas` (aliases `centros de especialidades
  odontologicas`, `ceo`, `especialidades odontologicas`), layer 133 (2 centres). The bare `centro de especialidades`
  is not a type (medical or dental), and there is no `caps infantil` or `caps ad` alias (the tool has no such filter).
- The `caps` note and the v0.45 `estabilizacao psiquiatrica` note now lead with the emergency sentence followed by
  "Emotional support: CVV 188 (24 hours, free call)." (number read by hand on cvv.org.br; no link is returned). The
  `caps` note says `open_periods.all_day` is the layer's 24-hour flag and that a CAPS listed is not always the one
  that serves you (ask a CAPS Infantil which ages it takes; some list in `hours` the regionais they serve): ask your
  health unit or call the CAPS. The medical specialty note says being listed does not mean walk-in care, to check
  with the health unit whether a referral is needed (no record of layer 132 says how patients are referred) and that
  mental health is type `caps`; the dental
  note says, as layer 133 publishes, that referral is through the health units. Both say not for emergencies (192 or
  193) and that an ouvidoria@ e-mail is the SMS Ouvidoria's. The `type` description names the new types (snapshot
  updated, within 400 characters).
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Seven hand requests to it that day (robots.txt, and each layer's metadata and one whole-layer read) and two to
  `cvv.org.br` (robots.txt, which allows `/`, and its home page), recorded in [docs/sources.md](docs/sources.md); the
  server never contacts `cvv.org.br`. The link allowlist is unchanged.
- Citizen eval: new q124 ("Onde fica o CAPS mais perto do Centro e qual o horário?") answered by
  `city_facilities_search` `caps` with `near` a point in Centro, on a synthetic fixture. 120 of 124 answered. The
  Curitiba App table's Health information row also names CAPS and specialty centres.

## 0.45.0 - 2026-11-25

UPAs and public hospitals with hours, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: three new `type`s read live from IPPUC's GeoCuritiba urban-equipment layers, with the
  same fields, filters, host gate, cache and phone and e-mail allowlist as the other layers: `upa` (aliases `upas`,
  `unidade de pronto atendimento`, `unidades de pronto atendimento`, `pronto atendimento`, `upa 24h`, `upa 24
  horas`), layer 130 "Unidade de Pronto Atendimento" (9 UPAs when read on 2026-11-25, all with `func_24hr` "Sim" and
  "Diariamente, 24 horas"); `hospital publico` (alias `hospitais publicos`; the bare `hospital` is not a type, since
  the layer lists public hospitals only), layer 129 "Hospital (público)" (10 records, municipal, state, federal and
  military); `estabilizacao psiquiatrica` (aliases `unidade de estabilizacao psiquiatrica`, `unidades de
  estabilizacao psiquiatrica`), layer 131 (1 record). Every note of the three types starts with "Emergency: call 192
  (SAMU) or 193 (Bombeiros). This tool lists places, it does not triage or say where to go." (new optional
  `leadNote` of a type, put before the general note) and says an ouvidoria@ e-mail is the SMS Ouvidoria's, not the
  unit's own. The `upa` note says `open_periods.all_day` is the layer's 24-hour flag and `hours` the detail (dental
  urgency hours differ), and that public hospitals are type `hospital publico`. Layer
  129's flags and hours are uneven (4 records with no hours, two last updated in 2016), so the `hospital publico`
  note says `all_day` false or no hours does not mean closed or not open 24 hours, that being listed does not mean
  walk-in care, and to check `updated` and call the hospital.
- The `unidade de saude` note now names the `upa` and `hospital publico` types and says 192 (SAMU) or 193 instead of
  "no UPAs or hospitals" and "go to a UPA". `health_units_search` (CNES) is unchanged and its description now points
  UBS, UPAs and public hospitals to `city_facilities_search`; the `city_facilities_search` description names UPAs and
  the `type` description names `upa`, `hospital publico` and `estabilizacao psiquiatrica` (snapshot updated, both
  within 400 characters).
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Seven hand requests that day (robots.txt, and each layer's metadata and one whole-layer read), recorded in
  [docs/sources.md](docs/sources.md). The link allowlist is unchanged.
- Citizen eval: new q123 ("Qual UPA perto do Boqueirão funciona 24 horas?") answered by `city_facilities_search`
  `upa` with `near` a point in Boqueirão, on a synthetic fixture. 119 of 123 answered. The Curitiba App table's
  Health information row also names UPAs and public hospitals.
- SPEC.md's approval line now says who approved it: the task brief, under Enzo's standing go-ahead, not reviewed by
  Enzo (0.43.0 and 0.44.0 wrongly said "Approved: Enzo").

## 0.44.0 - 2026-11-25

Municipal health units with hours, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_facilities_search`: new `type` `unidade de saude` (aliases `unidades de saude`, `ubs`, `unidade basica`,
  `unidades basicas`, `unidade basica de saude`, `unidades basicas de saude`, `posto de saude`, `postos de saude`; not the bare `saude`
  or `posto`), read live from IPPUC's GeoCuritiba urban-equipment layer 134 "Unidade de Saúde" (109 records when read
  on 2026-11-25, all with `divulgar_endereco` "Sim" and their hours in `observacao`, such as "2ª a 6ª feira, das 7h às
  17h"; `dt_atualiz` 2025 or 2026). Same fields, filters, host gate, cache and phone and e-mail allowlist as the other
  layers: 6 of the 109 units publish only a mobile number, which is dropped. Hours are returned as published text,
  never read as a promise: the type's `note` says a day not listed is not published as open, which is not a promise
  that the unit is closed or open, that `open_periods` are periods of the day and not days, to check by the unit's
  phone when one is given or the 156 before going, that an ouvidoria@ e-mail (every record has
  `ouvidoria@sms.curitiba.pr.gov.br`) is the SMS Ouvidoria's and not the unit's own, that UPAs and hospitals are not
  in the layer, and that emergencies go to 192 (SAMU) or a UPA.
- `health_units_search` (CNES) is unchanged and its description now says it has no hours and points municipal UBS
  to `city_facilities_search` `unidade de saude`; the `city_facilities_search` description names health units and the
  `type` description names `unidade de saude`, `ubs` and `posto de saude` (snapshot updated). To stay within 400
  characters the tool description no longer names libraries (still in the `type` description and `list types`).
- No new network host: `geocuritiba.ippuc.org.br` was already contacted; robots.txt rechecked (404) on 2026-11-25.
  Three hand requests that day (robots.txt, the layer's metadata, one whole-layer read), recorded in
  [docs/sources.md](docs/sources.md). The link allowlist is unchanged.
- Citizen eval: new q122 ("A unidade de saúde do Caximba abre no sábado?") answered by `city_facilities_search`
  `unidade de saude` with `name` `caximba`, on a synthetic fixture. 118 of 122 answered. The Curitiba App table's
  Health information row also names the health unit hours.

## 0.43.0 - 2026-11-25

Ouvidoria, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_service_guide`: new hand-written guide `ouvidoria`, written from the CGM's "Ouvidoria da CGM – Guia de uso"
  (4 pages, created 2024-05-10), read on 2026-11-25 from the Prefeitura's PDF on `mid.curitiba.pr.gov.br` (robots.txt
  404; an official document, facts and link only). That guide publishes no phone number for the Ouvidoria, so this
  one says so and gives no number as the Ouvidoria's. Steps: the Carta page, the Portal Curitiba Ouve
  (`www.curitiba.pr.gov.br/lei13460/`, public services, and where a denúncia can also be registered; taken from
  the PDF, not opened), the CGM e-mail `falecomacgm@curitiba.pr.gov.br` for illicit acts and unethical conduct (text
  the citizen sends from their own e-mail, a consent step with no link), the identified, confidential and anonymous forms, the Central 156 for the
  identified form's protocol, the 30-day answer (Lei federal 13.460/2017) and the PDF. Its `note` says the source is
  from 2024 and the channels may have changed. Carta words: `ouvidoria` + `cgm`, `ouvidoria` + `controladoria`,
  `ouvidoria` + `geral` + `municipio` or `curitiba` + `ouve` (not the bare word: other offices have their own
  ouvidoria); the `156` guide gets `notFor: ["ouvidoria"]`, so an Ouvidoria title that names the 156 goes to this
  guide. Both mirrored in `scripts/coverage-report.mjs`.
- The tool description names the Ouvidoria's channels. Tool contract: one new `service` value (snapshot updated).
- No new network host; the link allowlist is unchanged (`mid.curitiba.pr.gov.br` and `www.curitiba.pr.gov.br` are in
  the Prefeitura's zone). Two hand requests on 2026-11-25 (robots.txt and the PDF), recorded in
  [docs/sources.md](docs/sources.md).
- Citizen eval: q110 ("Qual o telefone da Ouvidoria Geral do Município?") moves from the `useful_phones` gap to the
  guide, and q072 ("Qual o telefone da Ouvidoria da Prefeitura?") from `useful_phones` (nothing found) to the guide;
  a unit test keeps `useful_phones` answering nothing for "ouvidoria". 117 of 121 answered; the `useful_phones` gap
  label is gone. Curitiba App table: the Useful phones row becomes "guide + official link, citizen acts" (its other
  phones are `useful_phones` data; the Ouvidoria was the only reason it stayed partial at v0.40): 16 of 18 rows
  covered (7 data, 9 guide).

## 0.42.0 - 2026-11-25

Vale-Creche, phase B of the 1.0 roadmap. 27 tools. Publishes nothing.

- `city_service_guide`: new hand-written guide `vale_creche`, written from Lei municipal nº 16.492 of 2025-03-11
  (Programa Voucher Educacional "Vale-Creche"), read on 2026-11-25 from the SME's PDF on
  `mid-educacao.curitiba.pr.gov.br` (robots.txt 404; an official act, Lei 9.610/1998 art. 8 IV). It says, without
  promising the voucher, that the law is for children of 0 to 3 years on the creche waiting list, in exceptional
  cases; that the family cannot choose between voucher and place and the SME decides; the law's priorities (income up
  to 3 state minimum wages, registered in the SME's online system, social vulnerability); and that the value is set
  every year by decree. It states no value. Steps: the Carta page, the law's PDF, the Educação portal, the `creche`
  guide for the waiting list (no separate application is described in the law) and the Central 156. Its `note` says
  what was not verified (whether the program is open in 2026, the value, deadlines and how families are called).
- New optional `fromDocument` on a hand-written guide: `checked_at` and a licence note naming the document it was
  written from, so this guide's envelope says neither "official sites checked 2026-11-24" nor "web search".
- The `creche` guide gets `notFor: ["vale"]`, so a Carta title "Vale-Creche" routes to `vale_creche`; Carta words
  `vale` + `creche`, both mirrored in `scripts/coverage-report.mjs`.
- Tool contract: one new `service` value (snapshot updated). The tool description also names the Vale-Creche rules,
  so a client picks it for that question.
- No new network host; the link allowlist is unchanged (`mid-educacao.curitiba.pr.gov.br` is in the Prefeitura's zone).
- Two hand requests on 2026-11-25 broke this project's robots rules by mistake (an `educacao.curitiba.pr.gov.br` page
  outside its Visit-time, and a page on `servicos.curitiba.pr.gov.br`, which is `Disallow: /`); both were deleted
  unread and nothing from them is used. Recorded in [docs/sources.md](docs/sources.md).
- Citizen eval: q112 ("Como peço o Vale Creche?") moves from the `vale_creche` gap to the guide, and new q121 asks it
  for a child of 2; 116 of 121 answered; the `vale_creche` gap label is gone. Curitiba App table: the creche row names
  the new guide (still 15 of 18 rows covered).

## 0.41.0 - 2026-11-25

Route planning between two points, phase B of the 1.0 roadmap. 26 → 27 tools. Publishes nothing.

- New tool `bus_route_between` ([ADR 0013](docs/adr/0013-direct-bus-lines-between-two-points.md)): `from` and `to`
  (`{lat, lon}`), `radius_m` (default 500, at most 1000, at both ends), `limit` and `offset`. It lists the URBS lines
  with an itinerary (same `ITINERARY_ID` in the stops file) that passes a stop near `from` before (lower `SEQ`) a
  different stop near `to`: `line_code`, `line_name`, `direction` (SENTIDO), `itinerary_id`, `board` and `alight`
  (`stop_number`, masked `stop_name`, straight-line `distance_m`) and `walk_m`, least walking first. Lines with an
  itinerary that has stops near both ends but none in that order are named in `other_lines` (at most 50). When the
  points are within twice the radius, `note` gives their straight-line distance. Direct lines only (no transfers or
  terminals), not real-time; an empty list suggests a larger radius or a terminal. It reads the newest local
  `pontosLinha` and `linhas` files: no network call, and a missing file is `data_not_available` as in
  `next_buses_near` (no GeoCuritiba fallback, since that layer has no lines per stop). The two points are not sent,
  cached, logged or returned.
- On the real 2026-11-20 files (points from that day's URBS `pois` file), Rodoferroviária → Parque Barigui at 500 m
  gives 979 TURISMO and the way back no line in order (979 in `other_lines`); at 1000 m, 979 and 464 one way, 464
  back. About 31 ms per call (median, Apple M4).
- `scripts/verify`: new timing guard `scripts/perf-bus-route-between.mjs` (17,496 generated stop rows, radius 1 km;
  median about 30 ms, fails over 400 ms); the stdio smoke test calls the new tool. `groupStops` in
  `src/tools/busStopsNear.ts` is now exported (no behaviour change).
- Tool contract: the new tool's input and output schemas (snapshot updated).
- Curitiba App table: the transport row now names the direct-line routing; still no favourites and no routing with
  transfers.
- Citizen eval: q111 (Rodoferroviária to Parque Barigui) moves from the `route_planning` gap to `bus_route_between`,
  and new q120 asks the way back; the shared synthetic URBS fixture gains six invented rows of line 903 between two
  stops placed near the two landmarks (coordinates from the URBS `pois` file, rounded to 3 decimals). 114 of 120 answered; the `route_planning` gap
  label is gone.
- No new network host for the server, no new dependency; the link allowlist is unchanged.

## 0.40.0 - 2026-11-25

Cultural spaces and attractions, phase B of the 1.0 roadmap. 26 tools. Publishes nothing.

- `city_facilities_search`: new `type` `ponto turistico` (aliases `pontos turisticos`, `atracao
  turistica`, `atracoes turisticas`, `linha turismo`, `linha de turismo`). It makes no network call and returns the 25
  boarding points of the Prefeitura's Linha Turismo, as listed on `linhaturismo.curitiba.pr.gov.br/onde-embarcar`
  (read 2026-11-25, bundled in `src/sources/linhaTurismo.ts`), in page order. Each item has the new optional output
  field `lookup` (`{type, name}`, or null for streets, squares and neighbourhoods): the call to this same tool that
  gives the place's address, hours as published and phone. It takes `name` only (matched against the stop name, the place's full name where the page abbreviates it, and the
  lookup name: "Mercado Municipal" finds "MERC.MUNICIPAL/RODOFERROVIARIA"); `bairro`, `near` or `radius_m` is
  `invalid_argument`. `list types` lists it last, with the page as its URL. The tool description names it as bundled
  Linha Turismo stops; its routing hint is now "Prefer this for hours or a phone" (shorter, to stay within 400
  characters).
- Tool contract: the `type` description and the item's `lookup` field (snapshot updated).
- Curitiba App table: "Cultural spaces and attractions" is now ✓ (data). "Useful phones" stays partial: no public,
  readable source gives a phone of the Ouvidoria-Geral do Município, so no line is labelled as the Ouvidoria.
- Citizen eval: q108 (pontos turísticos) and q109 (Ópera de Arame: its periods and phone, since no source publishes
  its visiting hours) move from gaps to `city_facilities_search`, with a `teatro` fixture (the real Ópera de Arame record and one invented theatre). 112 of 119
  answered; the `cultural_spaces` gap label is gone.
- No new network host for the server, no new dependency; the link allowlist is unchanged.

## 0.39.1 - 2026-11-25

Review hardening of 0.38.1 and 0.39.0. 26 tools. Publishes nothing.

- `city_service_guide` routing by Carta title: a deny list leaks through synonyms ("autuação", "penalidade",
  "vistoria"), so `estar` and `defesa_civil` now also need a positive word or the bare service title. `estar`: a
  purchase or activation word (`compra`, `comprar`, `crédito`, `créditos`, `ativação`, `ativar`) or the bare
  "EstaR - Estacionamento Regulamentado" (also spelled "Est@R"). `defesa_civil`: a subscription word (`cadastro`,
  `sms`, `receber`, `recebimento`) or the bare "Alerta(s) Defesa Civil". A bare title matches in any order, with
  "de", "da", "do", "Curitiba" or "URBS" around it. The deny words stay. Any other title
  gets the generated guide of that service; the guides' own Carta links follow the same rule. The "Est@R" query also
  needs `regulamentado`, since `est` and `r` are loose words. `scripts/coverage-report.mjs` mirrors the rule
  (`GUIDE_NEEDS`); a test keeps it equal.
- `defesa_civil`: a new step 5 opens the federal sign-up service page on `www.gov.br` ("Solicitar o recebimento de
  avisos e alertas de riscos de desastres e eventos adversos, da Defesa Civil", read 2026-11-25), with consent and
  nothing typed. It is its own step, so the CEP step still opens nothing; the SMS steps are now 6 and 7. Host already
  allowed.
- `weather_alerts`: the note names INMET's warnings portal as plain hosts with no scheme, so clients do not autolink a
  page this server never read: `avisos.inmet.gov.br` (named by INMET in June 2026) and the older
  `alertas2.inmet.gov.br`.
- Cleaned Carta text: the glued-sentence exception ("internet.Com o protocolo") applies only to one plain word before
  the dot and never to `www.`; "Pix-pague.Com", "pag2.Com", "pague.pix.Com" and "www.Com" become `[link removido]`. After a cut, the half-marker and
  last-word checks repeat until neither applies, so dropping a word such as `removido]"https://...` never leaves
  `[link` open. A seeded fuzz test (400 hostile inputs) checks the output never has `](` or `]:`, never ends inside a
  marker and stays within the cap.
- No new network host, no new dependency; the link allowlist is unchanged.

## 0.39.0 - 2026-11-25

Defesa Civil alerts, phase B of the 1.0 roadmap. 26 tools. Publishes nothing.

- `city_service_guide`: new hand-written guide `defesa_civil` (how to receive Defesa Civil alerts on the phone). It
  opens the service's Carta page, points to `weather_alerts` for INMET's active warnings that cover Curitiba, links Anatel's Defesa Civil Alerta page
  on `www.gov.br` (cell broadcast) and gives the SMS sign-up: typing the CEP in an SMS to 40199 and sending it are two
  separate consent steps; the CEP is never asked in the conversation and the assistant never sends anything. The
  SMS steps come from the Paraná government's page, which is not on the link allowlist, so they have no link; the
  guide's `note` says so. Emergencies: Defesa Civil 199. Carta words `alerta`/`alertas` + `defesa` + `civil`, mirrored
  in `scripts/coverage-report.mjs`. Tool contract: one new `service` value.
- `weather_alerts`: `note` also names INMET's warnings page (`https://alertas2.inmet.gov.br/`, named by INMET; it
  reset the connection here, so it was not read) and the `defesa_civil` guide.
- No new network host: INMET's API (`apiprevmet3.inmet.gov.br`) was already allowed; its robots.txt still answers 404
  (2026-11-25). The `city_service_guide` link allowlist is unchanged.
- Citizen eval: the two Defesa Civil questions are answered (the "is there an alert now" one by `weather_alerts`,
  city-wide, the "how do I receive alerts" one by the guide); `answered 110 / 119`, 9 gaps. Curitiba App
  comparison: 14 of 18 rows covered.

## 0.38.1 - 2026-11-25

Review hardening of 0.37 and 0.38. 26 tools. Publishes nothing.

- `city_service_guide` (`carta_id`): a Carta title with a notice, appeal, fine or credential word (`aviso`,
  `irregularidade`, `recurso`, `notificação`, `multa`, `defesa`, `credencial`, and their plurals) no longer gets the
  hand-written `estar` guide, which buys and activates parking time; it gets the generated guide of that service.
  With `service: "estar"`, such a title is no longer a Carta match either, so it neither makes the match ambiguous
  nor becomes the guide's Carta link. `scripts/coverage-report.mjs` mirrors these words (`GUIDE_NOT_FOR`).
- `estar`: the spelling "Est@R" (words `est`, `r`, `estacionamento`) also matches, for `carta_id` and for the guide's
  own Carta links. The install step says to install only an app named on the URBS EstaR page.
- `le_digital`: the install step says to check in the store that the seller is the Prefeitura Municipal de Curitiba
  (source in [docs/sources.md](docs/sources.md)).
- Cleaned Carta text: a cut never ends inside a `[link removido]` marker (its space hid the half marker from the
  last-word check); the cut goes before its `[`.
- `sharedCache` and the GeoCuritiba point cache read `Date.now` at each call, as `TtlCache`'s default does since
  0.36.0, so a test clock expires their entries.

## 0.38.0 - 2026-11-25

Lê Digital and EstaR guides, phase B of the 1.0 roadmap. 26 tools. Publishes nothing.

- `city_service_guide`: two new hand-written guides, `le_digital` (Curitiba Lê Digital: install the Curitiba App, log
  in or register, find and download the book) and `estar` (EstaR street parking: the URBS EstaR page, a
  URBS-credentialed app or sales point, login, the plate, buying credits, activating the time, and where to check a
  notice of irregularity). Login, personal data, payment and activation are separate consent steps; no price, hour or
  time limit is given. Each guide's `note` says which official page was not read (it answers 403 to non-browser
  clients, or no Lê Digital web page was found) and falls back to the Carta page and the Central 156; `checked_at` is
  2026-11-25 for these two and `license_note` says they were written from web search results. EstaR's Carta words
  are `estar`, `estacionamento` and `regulamentado` together, so other parking services keep their generated guide.
  Links only
  on hosts the allowlist already accepts; no new host. The `service` enum changed: `test/fixtures/tool-contracts.json`
  rewritten.
- `city_service_guide` (`carta_id`): cleaned Carta text never contains `]:` (a Markdown reference definition formed by
  a mask or a link marker followed by a colon); it becomes `] :`, as `](` already did, and the text is cut again if
  those breaks take it over the 300-character cap.
- Curitiba App comparison: Lê Digital and EstaR become guide rows; 13 of 18 rows covered. Citizen eval: the 4 Lê
  Digital and EstaR questions are answered by the new guides; `answered 108 / 119`, 11 gaps.

## 0.37.0 - 2026-11-25

Generated guides for every Carta service, phase C of the 1.0 roadmap. 26 tools. Publishes nothing.

- `city_service_guide`: new input `carta_id` (the `id` of a Carta service from `city_services_search`), given instead
  of `service`; exactly one of the two, else `invalid_argument`. For a service with no hand-written guide it returns a
  guide generated from your local Carta copy: fixed server steps (the official page, the online service when its link
  is allowed, then login, data and documents, sending and payment, each with `needs_consent` and a fixed consent text),
  `service` `carta`, `generated` (`carta_id`, `captured`, `reviewed_by_hand` false), `carta_text` (category, what, who,
  how, documents, channels, cost from the copy, cleaned: no HTML, only https links on allowed hosts, contact and
  CPF/CNPJ shapes masked, cut at 300 characters) and `checked_at` the copy's date. A hand-written guide whose Carta
  words match the title keeps priority, with that service's own Carta links. With no copy, an invalid one or an unknown
  id: no steps, `carta` with the reason (how to save the copy) and `available_guides` (`invalid_argument` with
  `open_step`). The tool contract (input and output schema) changed:
  `test/fixtures/tool-contracts.json` rewritten. New [ADR 0012](docs/adr/0012-generated-carta-guides.md).
- `carta-servicos.json` items may carry five optional fields (`who`, `how`, `documents`, `channels`, `cost`), read
  only by the generated guide; other values are ignored, so existing files stay valid. `city_services_search` is
  unchanged.
- `scripts/coverage-report.mjs`: a service the generated guide reaches counts as guide, and also as `guide_generated`
  (total, percentage and per category), with `reachable_without_generated_pct` and, in the terminal, the 30 most useful
  services only the generated guide reaches, so hand-written coverage and the next guides to write stay visible.
- Citizen eval: 5 questions on generated guides (rich fields, a bare item, an unsafe online link, hand-written
  priority, `open_step`); `answered 104 / 119`. The synthetic Carta fixture gains the optional fields on one item and
  one invented IPTU item (its pinned sha256 in `scripts/check-no-catalog` updated).

## 0.36.0 - 2026-11-25

Citizen eval, phase A of the 1.0 roadmap. 26 tools. Publishes nothing.

- New `test/eval/citizen-questions.json`: 114 invented citizen questions in Brazilian Portuguese (no personal data,
  places only as public landmarks), each mapped to the tool, the arguments and the answer shape expected (status ok,
  not_found, outside_curitiba, guide or an error code; fields present; the source or official link; for guides, the
  consent steps). Every tool has at least 2 questions; 15 questions no tool answers yet are gaps by label (Lê Digital,
  Defesa Civil alerts, EstaR, real-time buses, cultural spaces, useful phones, route planning, Vale Creche, other
  cities), counted and not failed.
- New `test/eval/citizenEval.test.ts` runs every question offline in `scripts/verify` (synthetic fixtures, one fixed
  clock, requests stubbed); new dev-only `scripts/eval-summary.mjs` prints `citizen eval: answered 99 / 114; gaps 15:
  ...` in `scripts/verify`. The citizen eval is described in `docs/roadmap-1.0.md`.
- `scripts/coverage-report.mjs`: the JSON summary is described as "numbers per category" instead of "aggregates
  only", since it keeps the Carta category labels. No behaviour change.

## 0.35.0 - 2026-11-25

Coverage scoreboard and the 1.0 gate (owner approval 2026-11-24). 26 tools. Publishes nothing.

- New `docs/roadmap-1.0.md`: 1.0 needs every Curitiba App row covered (a data tool, or a guide with the official link
  where a login is needed), every Carta de Serviços service reachable (data or guide), the extras kept, uncovered
  services worked on by usefulness to a Curitiba citizen, and Curitiba scope only.
- New dev-only `scripts/coverage-report.mjs` (not in the package): counts the Curitiba App table by status and, when
  your local `carta-servicos.json` exists, classes each service as data, guide or none per category, lists the 30 most
  useful uncovered services in the terminal and prints a JSON summary with aggregate numbers only. Tested with
  synthetic items; no catalog content is committed.
- `city_calendar`: `unit` or `date` with topic `holidays` or `iptu` now returns `invalid_argument` instead of being
  ignored. The school note says the quality evaluation Saturday counts as a school day, inferred from the printed
  per-month counts.
- Test fix: the in-memory cache reads the clock at each call instead of keeping the `Date.now` it saw at start, so a
  test's fixed clock applies to `checked_at` (a `bus_stops_near` test failed after midnight in Curitiba).

## 0.34.0 - 2026-11-25

Municipal school calendar 2026 (owner approval 2026-11-24). 26 tools. Publishes nothing.

- `city_calendar` takes `topic: "school"`, with optional `unit` (`escolas`, `cmeis`, `cmaees`; all three when
  omitted) and `date`; `unit` or `date` with no `topic` selects it (otherwise `holidays` stays the default). Per unit it returns the first and last day with students (2026-02-10 and 2026-12-18), the
  dated `periods` of each legend kind (vacations, recesses, holidays with their printed names, start and end days,
  pedagogical study days, the quality evaluation Saturday, Dia do Professor, and the escolas' class council weeks),
  the school days per month and total (199) as printed, and, with `date`, whether it is a school day. The note says
  it covers the municipal network only: state and private schools follow other calendars. `expired` from 2027.
- The dates were read from the Secretaria Municipal da Educação's three 2026 PDFs (downloaded once by hand on
  2026-11-25 02:16–02:18 UTC, 2026-11-24 in Curitiba, from `mid-educacao.curitiba.pr.gov.br`, which has no robots.txt) by the new dev-only
  `scripts/extract-school-calendar.py`. It maps cell colours and shapes to the PDF's own legend and fails unless the
  school days per month match the printed counts. The PDFs are not committed; only the dates, counts, URLs and
  sha256 are (`src/tools/schoolCalendarData.ts`). New input fields and a new output branch:
  `test/fixtures/tool-contracts.json` was rewritten on purpose.

## 0.33.0 - 2026-11-25

Consistency fix from the v0.32 review, and a school calendar check that ends without a tool (owner approval
2026-11-24). 26 tools. Publishes nothing.

- `place_at_point` outside Curitiba: a list or zoning whose layer is not asked there is now `null`, not `[]`
  (`service_areas.cras` with `areas: "care"`, `police_civil` and `fire` with `"safety"`, all three with `"all"`, and
  `place.zoning`). This matches the 0.32.0 rule that empty means "read, and nothing covers the point" and null means
  "not read". `health_units` and `police_military`, whose layers are read to decide `inside_curitiba`, stay `[]`.
  With `areas: "all"`, each group still decides `inside_curitiba` from its own first layer; near the city limit,
  when only one group finds the point inside, a new note says the other group's later layers were not asked (null).
  The output descriptions say so; `test/fixtures/tool-contracts.json` was rewritten on purpose.
- School calendar (Curitiba App comparison): not built. On 2026-11-25, inside the robots.txt Visit-time of
  educacao.curitiba.pr.gov.br, the Secretaria Municipal da Educação's "Calendários do ano letivo 2026" page held only
  links to three PDFs, and the 2027 calendars were one PDF; that robots.txt disallows `*.pdf`. docs/tools.md and
  docs/sources.md record the three requests and the robots.txt lines.

## 0.32.0 - 2026-11-24

One place facade for 1.0 (owner approval 2026-11-24). 28 → 26 tools. Publishes nothing.

- **Breaking:** `service_areas_at_point` and `census_at_point` are merged into `place_at_point` and leave tools/list.
  `place_at_point` takes `include` (`place`, `service_areas`, `census`; default all three) and `areas` (`care`,
  `safety`, or the new `all`), and returns `{data: {point, place, service_areas, census, partial}, notes,
  license_note}`: each part has its old fields without the point, plus its own `source`, `source_url` and
  `checked_at`. The old `note` strings are now `notes`, with the shared caveats once. The package was never
  published, so no external client breaks; `test/fixtures/tool-contracts.json` was rewritten on purpose.
- The parts' GeoCuritiba requests go one at a time per call (`pointReads`), first layer of each part first, under one
  call budget ([ADR 0011](docs/adr/0011-one-place-facade.md)). A cold call with every part makes about 5 requests and is
  `partial`; a part cut by the budget is null with a note, never a guess. When no part answers, the call fails as
  the single tools did.
- A list or zoning that was not read is now null, never empty: the five area lists of `service_areas` (null for a
  group not asked, or a layer not read, also with `areas: "all"` when one group is not read) and `place.zoning`
  when its layer could not be read. Empty still means the layer was read and nothing covers the point.
- A later layer cut by the call's time budget now says so ("the call's time budget ran out") in the place and care
  areas notes too; before, they said the host was busy or failing.
- Privacy rules unchanged: only the rounded point is sent; census sectors under 20 households stay withheld
  ([ADR 0009](docs/adr/0009-census-household-floor.md)).
- tools/list: 116,799 → 115,691 characters; descriptions 9,593 → 8,842 of the 9,600 ceiling. The new description no
  longer says "never logged", "not a certificate" or "untrusted data"; docs/tools.md lists them, and `notes` carries
  the last two in every answer.
- README: an empty `CURITIBAI_REMOTE_DATA` (some MCP clients pass empty variables) stops the server with the
  configuration error on stderr; unset it or set `0` or `1`.

## 0.31.0 - 2026-11-24

A quality round: the follow-ups from the v0.30 reviews and a pass that removes code without changing what the tools
answer (owner approval 2026-11-24). 28 tools. Tool names, schemas and the tools/list contract snapshot are unchanged.
Publishes nothing.

- `CURITIBAI_REMOTE_DATA` fails closed: `0`, `off`, `false` and `no` turn remote reading off and `1`, `on`, `true` and
  `yes` leave it on (case and spaces ignored; unset is on, as before). Any other value, empty included, stops the
  server at start with a configuration error that names the accepted values; before, `false`, `no` and an empty value
  silently left remote reading on. Inside the server a value that is not on keeps remote reading off.
- `server.json`: the `CURITIBAI_REMOTE_DATA` description says it also stops `bus_stops_near` from reading the
  GeoCuritiba stop layer, and lists the accepted values.
- `city_service_guide`: with one of several Carta matches refused, the message reads "1 of their links is not on the
  official-host allowlist and is not listed" (it said "are not").
- The `bus_stops_near` message when remote reading is off says "is not on" (it said "is 0 or off").
- The `bus_stops_near` description does not mention the switch: it would not fit the description size guard
  (369 of 400 characters for this tool, 9,593 of 9,600 for all of them).
- Code removed, no answer changed: `failFrom` takes an optional hint for the end of its message, so `bus_stops_near`
  and `tax_reform_curitiba` no longer re-parse the JSON text of a failure to add a sentence (`failurePayload` and its
  test are gone); the GeoCuritiba source has one request helper and one ArcGIS answer check instead of four and three
  copies; one `isObject` instead of four; the mask is imported from `src/mask.ts` instead of through `pncp.ts`.

## 0.30.0 - 2026-11-24

Follow-ups from the v0.29 reviews (owner approval 2026-11-24). 28 tools. Publishes nothing.

- `bus_stops_near` can stay local: with `CURITIBAI_REMOTE_DATA=0` (or `off`), the switch that already turned off the
  published copy of events and phones, the tool no longer reads the GeoCuritiba stop layer when there is no
  `pontosLinha` file; it answers `data_not_available` (with how to use the export), as before 0.29.0, and makes no
  request. Unset, the 0.29.0 fallback is unchanged. docs/privacy.md, docs/local-data.md, docs/tools.md,
  docs/sources.md and the README say so; the README no longer says that every bus tool needs `CURITIBAI_DATA_DIR`.
- `bus_stops_near`: a failure text that is not JSON with a string `error` is passed on as is instead of throwing
  while the "how to use the export" hint is added.
- `city_service_guide`: when the one Carta title that matches has a link outside the official-host allowlist, the
  message says it matched but its link is not on the allowlist (status `no_match`, no link) instead of "No service
  matched"; when two or more match and every link is refused, the status is `ambiguous` (it was `no_match`) and the
  message says no link is on the allowlist; when only some are refused, it says how many were left out of `matches`.
- Tests: the `local_csv_summary` sweep of every filter and group (about 60 calls) has its own 20 s timeout; it took
  5.09 s on a GitHub runner once and failed CI. The global timeout is unchanged.
- A CEP lookup through OpenCEP was considered and not built: opencep.com publishes no terms of use and no licence for
  its data (the MIT licence of its repository covers the software), which describes itself as Correios and IBGE data.

## 0.29.0 - 2026-11-24

`bus_stops_near` answers without the URBS download (the proposal in PR #38, "URBS layers on GeoCuritiba"; owner
approval 2026-11-24). 28 tools. Publishes nothing.

- `bus_stops_near` with no local `pontosLinha` file (or no `CURITIBAI_DATA_DIR`) reads the stops of IPPUC's
  GeoCuritiba layer `URBS_Transporte_Publico/MapServer/1` (7,249 records on 2026-11-24): 4 fixed pages of 2,000,
  read one after another through the existing GeoCuritiba host gate and time budget, the assembled layer cached
  6 hours, and filtered in the server (the position is never sent). A call stopped by the time budget answers
  `rate_limited` and the next call within 10 minutes resumes from the pages read; a partial layer, a layer with no
  stop or with more than 5% unusable records is never answered from (`source_unavailable`, with how to use the
  export instead). Only `num`, `nome_ponto` and
  `tipo` are asked; layer 0 (terminals, with `indfiscal`) is never read.
- When the export exists, the answer is unchanged, with lines per stop from the export. An invalid or not allowed
  stops file keeps its error (no fallback). `line_code` without the export is `data_not_available`.
- Contract change, on purpose: `data.source` (`urbs_export` or `geocuritiba_layer`) is new, and `lines` is now
  nullable (null from the layer, which has no lines per stop). `note` says which source answered and that the layer
  publishes no update date, so its freshness cannot be proved; `checked_at` is then the day the layer was read.
  `openWorldHint` is now true. Description and title updated within the tools/list size guard (descriptions 9,593 of
  9,600 characters).
- `city_service_guide`: `cartaFor` now passes each match's `official_url` through the host allowlist itself and drops
  the match when it fails, so the guide no longer depends on the catalog reader's validation (low finding of the v0.28
  review). Ambiguity still counts every title match, so a dropped match never turns two candidates into one link.
  Matches carry the normalized URL.
- docs/tools.md (bus tools, Curitiba App "Transport information" row), docs/sources.md (robots.txt and sample
  request re-checked, live counts), docs/local-data.md, docs/privacy.md, README.

## 0.28.0 - 2026-11-24

Route 2: the citizen's own assistant can help them use city services that need a login, only with their explicit
authorization at every step (owner approval 2026-11-24). CuritibAI stays read-only. 27 → 28 tools. Publishes nothing.

- New `city_service_guide`: numbered steps and official links for `156`, `saude_ja`, `iptu`, `cartao_transporte`,
  `agenda_online`, `creche` and `detran`. Every step that leaves the conversation has `needs_consent: true` and a
  plain-Portuguese `consent` line saying what will happen and what the citizen types on the official site. The first
  step says not to ask for personal data in the conversation. `note` tells the assistant to go one step at a time,
  ask first, stop without a yes, and never type passwords, CPF or payment data. The input is a guide id and a step
  number only. The tool makes no network call, never logs in or submits, and never receives personal data.
- Links are https on allowlisted official hosts only: subdomains of `curitiba.pr.gov.br` (not the obituary system),
  `www.detran.pr.gov.br`, `www.agendamento.detran.pr.gov.br` and `www.gov.br`. Each was checked by hand on 2026-11-24
  (docs/tools.md). Links from the user's Carta copy pass the same check, and only a unique match gives a link.
  A raw link with a backslash, whitespace or control character is dropped; only the normalized URL is returned.
  Carta titles in `matches` are cut to 120 characters. Known limit: any `curitiba.pr.gov.br` subdomain is accepted.
  Without the copy, `carta.message` says how to save it.
- Optional `open_step`: when the client supports MCP URL-mode elicitation, the server asks the client to show the link
  and its host for the user's approval. Accept returns the link; decline or cancel return none and say to stop, and
  `carta` then carries only its status. Choosing, typing and confirming are separate consent steps.
  Without the capability, the link is returned with the instruction to ask in the conversation first.
- The Prefeitura's Autorização Digital (e-Cidadão) is mentioned as information only.
- [ADR 0010](docs/adr/0010-service-guides-consent-at-every-step.md); docs/tools.md (reference, allowlist, Curitiba
  App rows 156, scheduling, IPTU, Cartão Transporte and creche), docs/privacy.md, docs/local-data.md. Handlers now
  get a per-call context (`ToolContext`) with `elicitUrl`; existing tools ignore it.

## 0.27.1 - 2026-11-24

Docs only: no code, test or behaviour change. Publishes nothing.

- [ADR 0009](docs/adr/0009-census-household-floor.md) is accepted: the owner decided on 2026-11-24 that the
  `census_at_point` privacy floor stays at 20 occupied private households (29 of 3,190 sectors withheld at 0.27.0).
  The ADR no longer calls the floor undecided; `SPEC.md` describes 0.27.1.

## 0.27.0 - 2026-11-24

More of what a citizen asks, from the GeoCuritiba host the server already reads (same host gate, cache and
fail-closed parser), and two dated notes that need no request. 25 → 27 tools. Every source was re-checked on
2026-11-24 before coding ([docs/sources.md](docs/sources.md)). Publishes nothing.

- `city_facilities_search`: new types `local de votacao` (TRE-PR's 422 voting places via IPPUC, with `sections` and
  `electoral_zone`; the number of voters is never asked for, and the note says the list cannot tell a voter their own
  place), `terminal` and `terminal metropolitano` (the 23 bus terminals with their integrated lines). New optional
  input `name` (every word in the name). New output fields `sections` and `electoral_zone` (null for other types).
  Behaviour change: `hours` longer than its cap (30 lines; 80 for terminals) now ends with a line saying how many were
  not shown, instead of a silent cut.
- `service_areas_at_point`: new input `areas` (`care`, the default and the previous behaviour, or `safety`): the
  Polícia Militar company, Polícia Civil district and fire platoon areas covering a point. New output fields `areas`,
  `police_military`, `police_civil` and `fire`; `inside_curitiba` and `partial` now also describe the `safety` layers.
- New `census_at_point`: the IBGE 2022 census sector of a point (residents, households, density, mean income of
  household heads) and its neighbourhood's totals; sectors under 20 occupied households are withheld and left out of
  the totals, so they cannot be subtracted back ([ADR 0009](docs/adr/0009-census-household-floor.md), proposed).
- New `city_calendar` (bundled, no network): the Prefeitura's 2026 holidays, optional days and closures (Decreto
  2.385/2025; schools follow their own calendar) and the IPTU 2026 general rule (secondary source); `expired: true`
  from 2027-01-01.
- The URBS transport layers on GeoCuritiba were compared with the URBS export: not used by the bus tools (no
  timetable, no stop order, no update date); see [docs/sources.md](docs/sources.md#urbs-transport-layers-on-geocuritiba-evaluated-2026-11-24-not-used-by-the-bus-tools).
- [docs/development.md](docs/development.md#release), first release step 6: if the hashes differ, do not run the
  registry step; deprecate 0.26.1, investigate and publish the next version through the workflow. The release-docs
  test pins the first release to 0.26.1 instead of the `package.json` version.

## 0.26.1 - 2026-11-24

Hardening of the release path added in 0.26.0 (findings of the security review). 0.26.1 is the first version to
publish (0.26.0 was never published; tag `v0.26.0` lacks this hardening and must not be published from); this change
itself publishes nothing. No tool behaviour, name, description, schema or output changed.

- `.github/workflows/publish.yml`: the publish job keeps the tarball whose sha256 it checked against the verify job,
  hashes it again right before the upload and runs `npm publish ./<file>.tgz --ignore-scripts` on that file, instead
  of deleting it and letting `npm publish` pack the tree again. `test/workflows.test.ts` checks it (one `npm pack`,
  no delete, the second hash check before `npm publish`).
- [docs/development.md](docs/development.md#release): environment `release` with "Allow administrators to bypass
  configured protection rules" and "Prevent self-review" off; the `v*` tag ruleset is required, not suggested; approve
  a run only on `main` or on a `v*` tag the owner pushed, at the release commit (the sha256 only proves the tarball did
  not change between the two jobs, not where it came from); the accepted risk that any of the owner's tokens with the
  `repo` scope can approve through the API; `npm logout` right after the first manual publish; not verified whether
  the MCP Registry accepts the GitHub OIDC login with an `environment:release` subject (the first run shows it before
  `npm publish`).
- The publish job requires npm 11.20.0 or newer (the npm of Node 26.13.1, pinned in `.nvmrc`; was 11.5.1) and
  installs no other npm.
- First release: 0.26.1, tagged on the merge commit of PR #37, run on tag `v0.26.1`. The manual publish packs once,
  notes the sha256, publishes that file (`npm publish ./curitibai-mcp-0.26.1.tgz --ignore-scripts --access public`) and
  runs `npm logout`; the workflow run afterwards cross-checks its summary sha256 against it. `test/workflows.test.ts`
  fails when the "First release" section is not the `package.json` version or its `git tag`/`git push` commands name
  another tag. README's npm note says 0.26.1. "Approving a run": never approve a run on tag `v0.26.0`.

## 0.26.0 - 2026-11-24

Release preparation for npm and the MCP Registry. Nothing is published by this version; no tool behaviour, name,
description, schema or output changed.

- `package.json`: no longer `private`; `files` limits the package to `dist/`, `CHANGELOG.md` and
  [docs/licences.md](docs/licences.md) (the data licences, including the ODbL notice of the bundled OpenStreetMap
  extract in `dist/sources/osmBundled.js`), plus `package.json`, `README.md` and `LICENSE`, which npm always adds.
  Added `mcpName` (`io.github.Bossmann007/curitibai`), `repository`, `homepage`, `bugs`, `keywords` and
  `publishConfig.access: public`. The package name stays `curitibai-mcp`.
- `server.json`: the MCP Registry entry (schema 2025-12-11), with the npm package as a stdio package and the two
  optional, non-secret environment variables `CURITIBAI_DATA_DIR` and `CURITIBAI_REMOTE_DATA`.
  `test/serverJson.test.ts` validates it against the vendored schema (`test/fixtures/mcp-registry/`) and checks that
  its name, version and package match `package.json`.
- `scripts/verify` installs with `npm ci --ignore-scripts` (no dependency install script runs) and runs
  `scripts/check-pack.mjs` after the build: `npm pack --dry-run --json` must list only allowed
  paths (no `data-local/`, tests, fixtures, `src/`, `.env*` or `*.local`, no `dist/` file without a `src/` module, no secret-shaped line), and the packed size, printed, must stay
  under 250,000 bytes (0.26.0: about 179,000).
- `.github/workflows/publish.yml`: started by hand only (`workflow_dispatch`), on the commit tagged
  `v<version>`. npm trusted publishing (OIDC) and the MCP Registry with GitHub OIDC; no secret. The OIDC token is only
  in the publish job, which runs no `npm ci` and no tests (it gets `dist/` from the verify job) and runs in the
  GitHub environment `release` (the owner approves each run; only `main` and `v*`), after checking that the tarball's
  sha256 is the one the verify job printed in its summary. Release steps in
  [docs/development.md](docs/development.md#release); README has an [Install from npm](README.md#install-from-npm-after-the-first-release)
  section for after the first release.
- [Compared with the Curitiba App](docs/tools.md#compared-with-the-curitiba-app): the 156, Scheduling and Cartão
  Transporte rows no longer say flatly that they need a login (the linked 2026 sources do not say so): "needs a
  registration or login (owner's note; not confirmed in the linked sources); out of scope".

## 0.25.2 - 2026-11-23

Docs only: no tool behaviour, name, description, schema or output changed.

- [Compared with the Curitiba App](docs/tools.md#compared-with-the-curitiba-app) refreshed: since March 2026 the app
  has an AI assistant and about 1,000 services (including the former Curitiba 156 app), each fact linked to the
  Prefeitura news page that states it (and a Bem Paraná reprint for Saúde Já). New rows: AI assistant (partial:
  CuritibAI is an MCP server for the assistant you pick and does not answer by itself), creche and student
  registration with Vale Creche (out of scope), school calendar (not covered yet) and IPTU payment (out of scope). The
  Curitiba Lê row now says what Curitiba Lê Digital offers; the transport row names the app's no-login visitor access
  and favourite routes.

## 0.25.1 - 2026-11-23

Only text changed: no tool behaviour, name, title, type, schema or output changed.

- "Health unit near me" routing: `health_units_search` takes no position, and its description now says so and points
  to `city_points_search` with `near` (health units) or `vaccination_sites_search` (vaccines);
  `city_points_search` names health units near a position among its uses
  ([docs/tools.md](docs/tools.md#which-place-tool)). To make room, `health_units_search` no longer says that private
  and non-profit units are not returned (it says public-administration) nor how to page; both stay in
  [docs/tools.md](docs/tools.md#notes-moved-out-of-the-tool-descriptions) and its `next_page`/`next_skip` fields.
- `local_csv_summary`: the description says again that personal columns are refused by column name only, so other
  columns may still hold personal data (the full rules stay in docs/tools.md and ADR 0008).
- Descriptions sum 8,705 → 8,699 characters; every description still at most 400.

## 0.25.0 - 2026-11-23

Only text changed: no tool behaviour, name, title, type, required field, enum, output or `outputSchema` changed.

- Every tool description is at most 400 characters: what the tool does, when to use it and its main input, plus what
  the model needs before calling (what is sent where, "not for emergencies", "not real-time", the local file needed,
  the cold-call time of the point and Guaíra tools, the untrusted-text warning). The OSM credit stays in
  `places_search`'s `attribution` and `license_note`; paging details and edge-case rules moved to
  [docs/tools.md](docs/tools.md#notes-moved-out-of-the-tool-descriptions). Descriptions sum 15,561 → 8,705 characters;
  `tools/list` 107,011 → 100,051.
- `places_search`, `city_points_search` and `city_facilities_search` each say when to prefer them, so each kind of
  place has one tool ([docs/tools.md](docs/tools.md#which-place-tool)). No tool merged or renamed.
- Input field descriptions: three redundant clauses removed (`open_datasets_search.query`, `places_search.category`,
  `procurement_search.query`; each said again what the tool description says). The contract snapshot
  `test/fixtures/tool-contracts.json` was rewritten on purpose; it equals the 0.24.1 one once descriptions are removed.
- Guard: `test/contracts.test.ts` fails when a description is over 400 characters or all of them sum over 9,600
  (SPEC.md). `places_search`'s description no longer carries the police note; every police result's `note` still does.

## 0.24.1 - 2026-11-23

Tests and guards only: no tool behaviour, name, description or schema changed.

- Contract test (`test/contracts.test.ts`): the name, `inputSchema` and `outputSchema` of every tool, as the real
  server sends them in `tools/list`, are kept in `test/fixtures/tool-contracts.json`. The test fails naming each tool
  added, removed or changed; rewrite the snapshot on purpose with `npm run contracts:update` and add a CHANGELOG entry
  for the change (docs/development.md).
- The same test prints the size of `tools/list` in characters. Baseline at this version (25 tools): descriptions
  15,561, inputSchemas 19,636, outputSchemas 63,226, total 107,011 (SPEC.md). No ceiling yet.
- Unit tests on a fake clock for `src/hostGate.ts` (spacing between request starts, `maxQueueWaitMs`, failures
  remembered 60 s or a 429's Retry-After capped at 1 hour, a waiting request refused when an earlier one failed) and
  `src/cache.ts` (one shared load per key, failed loads not stored, expiry at the TTL, `maxEntries` eviction).
- `guaira_events`: the deprecated `partial` field (alias of `truncated` since 0.18.3) is removed no earlier than
  2027-03-01, in the first minor release on or after that date, with its own entry here. It is unchanged in this
  version.

## 0.24.0 - 2026-11-23

- `city_facilities_search`: nine sport and leisure types from IPPUC's "Esporte e Lazer" layers (SMELJ):
  `nucleo regional do esporte`, `centro de atividade fisica`, `centro da juventude`, `centro de iniciacao ao esporte`,
  `centro de referencia em esporte`, `pista de bmx`, `centro de lutas`, `pista de patinacao`, `velodromo`; and three
  conservation unit types from the SMMA conservation units service: `estacao ecologica`, `bosque de conservacao`
  (`bcbu`), `refugio da vida silvestre`. Same fields, address flag and contact allowlist as the other layers; credit
  "Fonte: IPPUC/GeoCuritiba (SMELJ / SMMA)" for these types (the others keep "IPPUC / GeoCuritiba"). The conservation
  layers publish no update date (`updated` null; `note` says so and that a protected area is not always open to visits).
  Live queries only, no layer copied.
- Left out on purpose (docs/sources.md): the SMELJ service itself (no `divulgar_endereco` flag; the same records are
  read from the per-type layers), RPPNM (private land, often named after people, with the lot's street address:
  personal data), APA and ARIE (no bairro or kind fields), and the parks and bosques already in `parque`.
- `service_areas_at_point` returns `inside_curitiba` (boolean, as `place_at_point`): true when a health unit area
  contains the point; when none does, the cadastral bairro layer decides (its answer is shared with
  `place_at_point`'s cache), and outside the CRAS layer is not asked. Still 2 requests in the common case; 3 when no
  health area contains the point. A bairro layer failure is an error.

## 0.23.0 - 2026-11-23

- New tool `service_areas_at_point` ("quem me atende"): for a `{lat, lon}` inside Curitiba, the health unit
  (unidade de saúde) whose area covers the point, with its sanitary district, and the CRAS whose territory covers it,
  each with the reference date the area carries as published (e.g. "março/2022", "MAR-2019"; it varies by area) and a
  note that the area may have changed since. Read live from IPPUC's GeoCuritiba thematic map service
  (`GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica`, layers 19 and 5); credit "Fonte: IPPUC/GeoCuritiba (SMS e
  FAS)"; live queries only, no layer copied. 2 requests 5 s apart (a cold call takes about 5 s); a CRAS layer failure
  after the health layer was read returns what was read with `partial: true`.
- A new tool rather than more layers in `place_at_point`: those would make up to 6 requests 5 s apart, past the 20 s
  call budget, and slow every `place_at_point` call by 10 s (SPEC.md). `place_at_point` is unchanged.
- Privacy: same rule as `place_at_point` (0.22.0). The point is rounded to 4 decimals (about 11 m) first; only the
  rounded point is sent, cached (6 hours, at most 500 points) and returned, and nothing is logged
  ([docs/privacy.md](docs/privacy.md#details)). A point outside the Curitiba box is refused with no request.

## 0.22.0 - 2026-11-23

- New tool `place_at_point` ("onde fica"): for a `{lat, lon}` inside Curitiba, the neighbourhood (bairro), the
  regional, the zoning (code, name, law or decree, version date) and the nearest street within 100 m, read live from
  IPPUC's GeoCuritiba cadastral map service (`GeoCuritiba/Publico_GeoCuritiba_MapaCadastral`, layers 2, 41, 36 and
  12). Zoning comes from layer 41 (with the Decree 297/2026 areas), or from layer 36 (Lei 15.511/2019) where 41, which
  covers about 61% of the city, has no polygon. Same host, gate, timeout, cap and refusal rules as
  `city_facilities_search`; up to 4 requests 5 s apart (a cold call takes about 10–20 s); a zoning or street layer
  failure after the bairro was read returns what was read with `partial: true`. Credit "Fonte: IPPUC/GeoCuritiba";
  live queries only, no layer copied.
- Privacy: this is the first tool that sends a position to a source. The point is rounded to 4 decimals (about 11 m)
  first; only the rounded point is sent, cached (6 hours, at most 500 points) and returned, and nothing is logged
  ([docs/privacy.md](docs/privacy.md#details)). A point outside the Curitiba box is refused with no request.
- 0.21.3 entry below: "so no count in an answer is 1 to 4" corrected to "so no group or filter count is 1 to 4"
  (`row_count` and `malformed_rows` are not masked).

## 0.21.3 - 2026-11-23

- **Breaking (input):** `local_csv_summary` refuses a call with `filter_column`/`filter_value` and `group_by`
  together, with the new error `filter_with_group_by_not_allowed` (before the file is read). A filter alone or
  `group_by` alone works as before. Subtracting filtered and unfiltered groups could give a group of 1 to 4 rows
  ([ADR 0008](docs/adr/0008-local-csv-summary-small-counts.md), owner decision 2026-11-23).
- **Breaking (output):** `local_csv_summary` `group_by.other_count` of 1 to 4 is `"<5"` without a filter too (0 stays
  0), so no group or filter count is 1 to 4. This is not a protection: `row_count - malformed_rows - sum(top)` gives the
  number back. `group_by.distinct_values` is always a number (it was `"<5"` only with a small filter).
- Known limits, kept (ADR 0008): two allowed filters on the same column can be subtracted from `row_count`; with
  `group_by` alone, when only one group is unlisted, `row_count - malformed_rows - sum(top)` is that value's size.

## 0.21.2 - 2026-11-23

- **Breaking (output):** `local_csv_summary`: with a filter, a `group_by.other_count` of 1 to 4 is `"<5"` (0 stays
  0), as small groups already are. A filter that leaves 1 to 4 well-formed rows out is refused (`column_not_allowed`,
  for that value only), because `row_count - malformed_rows - matched_rows` would give their exact count. Known
  limits, kept because the output schema is frozen and one query is checked at a time: when every group of 5 or more
  is listed, `matched_rows` minus their counts still gives a masked `other_count` back, and two allowed filters on the
  same column can be subtracted from `row_count` (docs/local-data.md).
- `receita-version.yml`: a second schedule entry on day 2 (09:23 UTC) retries a day-1 run dropped from the shared
  `data-branch` queue; with nothing changed since day 1 it makes no commit and opens no issue.
- `scripts/check-release.mjs`: a copy that is not a git clone (tarball or zip, no `.git` at the root) or a machine
  without git says "tag checks skipped" and still checks the version against the CHANGELOG (exit 0 when it matches).
- `events/events.json` and `phones/phones.json` (local and on the `data` branch) carry `"credit": "Fonte: Instituto
  Municipal de Turismo de Curitiba"` next to `source`, the page the facts came from; facts only, as before. Servers
  before 0.21.2 read the new files unchanged. docs/sources.md records the owner's premise (Lei 9.610/98 art. 8º, V and
  VI; no terms found; the Instituto not contacted).
- CONTRIBUTING: after merging a version, tag the merge commit `vX.Y.Z` and push the tag (ADR 0006).

## 0.21.1 - 2026-11-23

- **Breaking (output):** `local_csv_summary` `matched_rows`, `distinct_values` and `other_count` can be the string
  `"<5"` instead of a number.
- `local_csv_summary`: a filter that matches fewer than 5 rows (0 included) returns `"<5"` for `matched_rows`,
  `group_by.other_count` and `group_by.distinct_values` instead of the number, as groups under 5 rows already were
  (those three fields are now a number or the string `"<5"`).
- The shared in-memory cache of portal, OpenStreetMap and CNES answers keeps at most 500 entries (oldest dropped first).
- The server reports the version written in `package.json` (no second copy in `src/server.ts`).
- `collect.yml` and `receita-version.yml` share the concurrency group `data-branch`, so they never push to the `data`
  branch at the same time; `scripts/publish-data.sh` redoes a rejected push once on the new tip (never forced), like
  `scripts/publish-receita-version.sh`.
- `scripts/verify` checks that `package.json` matches the newest CHANGELOG release and, in a clone with tags, that the
  previous release (and, on `main`, the current one) has its `v` tag (`scripts/check-release.mjs`).
- SPEC.md describes this version only; decisions that were written only there are now ADRs 0005 to 0007 in `docs/adr/` or
  lines in `docs/sources.md` (Cultura e-mails and `mixedOwnership` approval, Receita date bound and known gap).
- New monthly workflow `.github/workflows/receita-version.yml` (day 1, 09:23 UTC, plus manual runs): one GET to the
  Receita Federal pilot calculator's open-data `versao` endpoint and the latest release of
  `ReceitaFederal/calculadora-rtc-regime-regular` and `calculadora-rtc-simples-nacional`. It records
  `receita/version.json` on the `data` branch and, when the app, base or a release tag changed, opens one issue
  ("Receita: calculadora mudou (...)") with what changed and a reminder to review curitibai. Nothing changed: no
  commit, no issue. Fails closed (`scripts/check-receita-version.mjs`, Node built-ins only). docs/development.md
  "Scheduled workflows" says how to turn it off.

## 0.21.0 - 2026-11-23

- New tool `tax_reform_curitiba` (23 tools), read-only and fixed to Curitiba (IBGE 4106902, PR), from the Receita
  Federal pilot "calculadora de tributos do consumo" open data: `rates` gives the CBS, IBS UF and IBS municipal
  reference rates on a date from 2026 (default today) with the Receita app and base versions; `nbs`, `ncm` and
  `class_trib` find codes by code or words (matched locally, never sent), with the cClassTrib reduction percentages;
  `nfse` returns a fixed, dated note on NFS-e in Curitiba (Emissor Nacional, schedule, Decreto 1960/2025, Portaria
  33/2025) with no network call. Every answer says "API piloto da Receita Federal; não é orientação fiscal; confirme
  com o contador". Dates from 2027-01-01, and answers the Receita marks with `x-warning-dados-simulados`, come with
  `simulated: true` and the note "valores simulados pela Receita Federal; não são alíquotas definitivas" (dates up
  to 2099-12-31). No calculation and no invoice.
- New allowed host `piloto-cbs.tributos.gov.br` (robots.txt 404): one request per 5 s, 15 s timeout, 24 h cache.
- `TtlCache` takes an optional entry limit; `fetchText` results also carry the response headers.

## 0.20.0 - 2026-11-23

- `city_facilities_search`: six new types from the Cultura group of IPPUC's GeoCuritiba urban-equipment service:
  `centro cultural` (24 records on 2026-11-23), `espaco expositivo` (Espaço Expositivo de Artes, 16), `memorial` (11),
  `cinema` (19, commercial cinemas included), `espetaculos ao ar livre` (Espaço para Espetáculos ao Ar Livre, 4) and
  `gibiteca` (1). Same request path, limits, cache and contact allowlist as the other point layers; no new tool.
- `city_facilities_search` with `museu`, `teatro`, `centro cultural`, `espaco expositivo`, `cinema` or
  `espetaculos ao ar livre`: `note` now says
  the layer may include private or non-profit venues and to confirm days and hours with the venue, not the 156.
- docs/tools.md "Compared with the Curitiba App": cultural spaces and attractions are partial (GeoCuritiba has no
  tourist-attraction layer); new "—" rows with the reason for Defesa Civil alerts, EstaR and real-time buses.

## 0.19.4 - 2026-11-23

- Nightly collection: a refusal by the events site ends the night. When `events/status.json` or `phones/status.json`
  records an HTTP 401, 403 or 429 or a changed robots.txt (`robots_changed`) on the UTC date, the later schedule
  entries that night make no request and write nothing (`code=refused_tonight`; exit 0 only with a successful
  collection in the last 24 hours, else 1, so the night stays visible as failed). The next night tries again. Other
  failures (5xx, timeout, network, `layout_changed`) are still retried by the next entry. Before, every later entry
  asked the site again after a refusal. Only with `CURITIBAI_COLLECT_ONCE_A_DAY=1`, set by `scripts/publish-data.sh`;
  a by-hand run is unchanged.

## 0.19.3 - 2026-11-23

- Nightly collection: the first scheduled run of `collect.yml` (2026-11-23) started 8.5 h late, outside the events
  site's robots.txt window, so nothing was collected and the `data` branch got only `status.json` files with
  `success: null`. GitHub can delay scheduled runs under load and drop queued ones. The workflow now has five
  schedule entries inside the window (02:37, 03:17, 03:59, 04:37 and 05:13 UTC). Once both steps (events and phones)
  succeeded on the UTC date, the later entries exit 0 at once with `code=already_collected`: no request, no file
  change, no push (`CURITIBAI_COLLECT_ONCE_A_DAY=1`, set by `scripts/publish-data.sh`).
- `scripts/fetch-events.mjs`: a run stopped by the window (`window_closed`) no longer writes `events/status.json` or
  `phones/status.json`, so a late run never replaces the record of a successful collection. It exits 0 when both
  steps succeeded in the last 24 hours, so a late duplicate does not show as a failed run, and 1 otherwise, so a
  night with no collection stays visible.

## 0.19.2 - 2026-11-22

- `procurement_search` with `query`: a single connection reset no longer switches PNCP's fast search off for 10
  minutes. On 2026-11-22, right after 0.19.1, `{query:"merenda"}` fell back to the page scan ("PNCP's fast search was
  unavailable (network error)"; 0 items, partial, 18.6 s) while a plain curl to the same search URL answered HTTP 200:
  PNCP resets connections at random (docs/sources.md). A connection error on a search request (reset, empty reply,
  reset while the body is read) is now retried once on the PNCP gate's next turn, 6 s later, instead of at once; the
  retry is skipped when it would start after the 20 s budget minus the 8 s search timeout and 1 s of slack, so the
  fallback scan can still start (on a later search page the call stops as `partial` with the search's `next_page`).
  The search is remembered as down only after two connection errors in a row (across calls); a timeout, 5xx or
  changed format still marks it at once, and a search answer resets the count.
- All sources: a connection error or timeout while a response body is read is now `source_unavailable` (network
  error or timeout), like one before the headers, instead of an unexpected error.

## 0.19.1 - 2026-11-22

- `procurement_search` with `query` now uses the search behind the pncp.gov.br site (`GET /api/search`, filtered to
  Curitiba and the modality; no key or login, robots.txt allows it; docs/sources.md) instead of reading Consulta
  pages and matching client-side. A search page of 100 takes about 1 s instead of 8–13 s for 50, so a text match is
  found on the first call: on 2026-11-22 `{query:"merenda"}` took 25 s, read 4 pages and returned 0 items, partial.
  The same host gate (6 s), 20 s budget, 5-page cap and cache apply. The window is applied client-side, and the scan
  stops once results were last updated before `from` (the search sorts by update date). A result is kept only when
  the returned object or body name contains the query (accents and case ignored), so a withheld object still never
  matches; supplier, user and free-text fields of the search records are never read. Without `query` nothing changes.
  `page`/`next_page` count search pages when `query` is set, and `source_url` is the search URL. Limits: the search
  matches whole words ("merend" no longer finds "merenda"); a window far in the past reads every newer match first;
  a record updated between calls moves to the top, so following `next_page` may repeat or skip one; a record with no
  readable publication date is counted in `discarded`.
- Fallback (owner decision 2026-11-22): when the search fails (network error, timeout or HTTP error after the single
  retry) or its format changed (`layout_changed`), the same call falls back to the Consulta page scan (same gate, 20 s
  budget for the whole call, allow-list and masking), and `note` says the fast search was unavailable. A 429 or a
  refusal never falls back (`rate_limited` or the refusal, as before). The search request times out after 8 s (it
  answers in 0.45–1.7 s; Consulta keeps 25 s), so the scan still fits in the budget; after a timeout, network error,
  5xx or changed format the search is not asked for 10 minutes in the process and calls go straight to the scan (a
  4xx for one page or query is not remembered). If the scan's first page cannot start within the budget after a
  failed search, the answer is `source_unavailable` with that reason, not `rate_limited`. A search failure after the
  first page returns what was found as `partial` with `next_page` 1 and `next_page_source` `scan`.
- New output `next_page_source` (`search` or `scan`) and input `page_source`: pass them back with `next_page`.
  `page_source: "scan"` with `query` continues the fallback scan; a search page that has to fall back restarts the
  scan at page 1 (said in `note`); `page_source: "search"` without `query` is `invalid_argument`. `skip` now accepts
  up to 100 for search pages (they hold 100); for the scan (pages of 50) a `skip` of 50 or more is `invalid_argument`.
- The query is sent to the search accent-stripped and lower-cased, so "saúde" and "saude" are one request. The
  search word is sent to PNCP (docs/privacy.md, tool description).

## 0.19.0 - 2026-11-22

Usability fixes found by calling every tool as a user (Praça Tiradentes). No new tool, no new host.

- `health_units_search` and `procurement_search` keep asking for pages until `limit` matches are found, instead of
  stopping after 5 (CNES) or 2 (PNCP) pages: "cajuru" found nothing on the first call because "UMS CAJURU" is on
  page 6. New caps per call: at most 20 CNES pages or 5 PNCP pages, and no page starts after 20 s (the budget of
  `river_levels` and `guaira_events`; a page already asked for is never cut). PNCP takes 8–13 s per page, so a call
  usually reads 2 or 3 pages. The 15 s second-page rule of PNCP is replaced by the 20 s budget. `note` says whether
  the page cap or the time budget stopped the scan; `partial`, `next_page` and `next_skip` work as before.
- CNES and PNCP requests now go through a host gate (`src/hostGate.ts`, ADR 0003), like ANA, GeoCuritiba and Teatro
  Guaíra: CNES at least 400 ms between request starts, PNCP at least 6 s (at most 20 requests in 2 minutes, the rate
  at which PNCP answered 429). After a failure neither host is asked again for 60 s (a 429's Retry-After when longer,
  at most 1 hour; 10 minutes after a refusal): following `next_page` inside the wait makes no request and returns the
  same error (`rate_limited` with the remaining wait after a 429, `source_unavailable` after a timeout, network error
  or refusal). Every 429 wait is now clamped to 60 s–1 hour: Retry-After 30 or none says 60 s, over 1 hour says about
  60 minutes. When the gate's next turn would start after the 20 s budget before any page was read, the answer is
  `rate_limited` (about 1 minute) instead of `source_unavailable`.
- `open_datasets_search`: when the portal finds nothing, the query is retried once without accents and then once
  with a synonym from a short list in `src/sources/portalSynonyms.ts` ("ônibus" and "busão" → "transporte
  coletivo", checked live); `note` says which query matched or lists every query tried. A failed retry keeps the
  empty answer as `partial` with the reason in `note`, which says that `total` 0 then means unknown, not none. No
  retry or later page starts after 20 s (the same budget).
- `river_levels`: stations with a recent reading (`status: ok`) come first, nearest first, then the others; fields
  unchanged. Before, PONTE BR-277 (no recent data) came first near the centre.
- `local_csv_summary` `file_not_found` now has a message: save the CSV in `CURITIBAI_DATA_DIR`, see
  `docs/local-data.md`.
- `events_search` and `useful_phones` `data_not_available`: before the first published copy, the message says the
  nightly GitHub collection publishes it (scheduled around 02:37 UTC; GitHub can delay it; one constant,
  `NIGHTLY_RUN_UTC`, checked against the cron and the docs) and points to `docs/local-data.md` to run the collector
  locally; other messages point to `docs/local-data.md` instead of the README.

## 0.18.5 - 2026-11-22

Docs and CI only; no tool, host or runtime behaviour changes.

- Docs split: the README is now a short entry point (install, the 22 tools, how data stays updated, privacy notice).
  The per-tool detail, the comparison with the Curitiba App, deferred tools and limits moved to `docs/tools.md`; the
  local files and the nightly collection to `docs/local-data.md`; collection rules and privacy details to
  `docs/privacy.md`; development to `docs/development.md`; licences to `docs/licences.md`. Text moved, not rewritten.
  `docs/sources.md` has a table of contents. `scripts/verify` now checks that every relative inline link and anchor in
  README.md, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md and `docs/*.md` resolves (`scripts/check-links.mjs`, Node
  built-ins only). The README keeps the old ids of the moved sections (`#tools`, `#tool-reference`, `#limits`, ...),
  so saved links still land on the page. `scripts/check-links.mjs` also checks `docs/adr/*.md`. The README test badge
  shows the `verify` workflow status instead of a fixed count; `docs/tools.md` says "Live tools" like the README; the
  `data_not_available` messages of `city_services_search` and the bus tools point to `docs/local-data.md`.
- New `docs/adr/` with an index and four architecture decision records, each citing where the decision is already
  written and the owner approval: 0001 facts and links only from sources with no licence found; 0002 nightly GitHub
  Actions collection to the orphan `data` branch; 0003 the shared per-host request gate (`src/hostGate.ts`); 0004 no
  automated access to hosts that disallow robots or refuse non-browsers (the user downloads those files). Linked from
  README and CONTRIBUTING.
- New PR-size guard: `scripts/pr-size.mjs`, run by `.github/workflows/verify.yml` on pull requests only (also when
  the body is edited), fails when a pull request changes more than 400 lines against its base, unless the body has a
  line starting with `Large PR because:` and a reason. `test/` and lockfiles do not count; renames count only edited
  lines; a revision starting with "-" is refused (exit 2). Checkout now fetches two commits. Rule in CONTRIBUTING.md, tests in `test/prSize.test.ts` and
  `test/workflows.test.ts`.

## 0.18.4 - 2026-11-22

Two `river_levels` fixes. No new tool, no new host.

- While the ANA host is blocked after a refusal (HTTP 401/403 or a CAPTCHA, 10 minutes), a station that is not cached
  now fails at once, before the host gate: no slot is reserved, nothing waits and no request is made. Before, the gate
  remembered the refusal only 60 s; after that, stations asked in the same moment queued for slots 5 and 10 s away
  and then failed without a request, so a call could wait about 10 s for nothing. Cached stations are still returned
  with `partial: true`. Tests with fake timers: a blocked host answers in under 50 ms with no request.
- A host or transfer failure on a later station (HTTP 5xx, a timeout, a network error, or an HTTP 200 answer that is
  not ANA's XML document) no longer drops the stations already read. They are returned with `partial: true`, the
  failed stations first in `more_matches`, and a note naming the failure (for example "The source failed (HTTP
  500)"); the host is not asked again for up to about 1 minute. `source_unavailable` is returned only when no station was
  read or cached. A station that was not read is never shown as `no_recent_data`. This matches the 429 and 403 paths.

## 0.18.3 - 2026-11-22

The three Low findings left by the v0.18.2 review. No new tool, no new host.

- `river_levels`: the note no longer says ANA publishes validated data "only months later" (that delay was not
  verified). It now says ANA also publishes validated (consistidos) series after deeper analysis and that this tool
  reads only the raw telemetry. A test asserts the note mentions no months.
- `river_levels`: a final refusal (HTTP 401/403 or a CAPTCHA) on a later station no longer drops the stations
  already read in the call. They are returned with `partial: true` and a note that the host refused this server; the
  10-minute block stays in force. `source_unavailable` is returned only when no station was read or cached. This
  matches the `rate_limited` path of 0.18.2. In this version other host or transfer failures still failed the
  whole call (changed in 0.18.4).
- `guaira_events`: `partial` is now documented as a deprecated alias of `truncated` (always equal). Both stay in this
  version; read `truncated` for missing listing pages and `details_pending` for event-page details. The README shows
  a cold and a warm call.

## 0.18.2 - 2026-11-22

The two Low findings left by the v0.18.1 review. No new tool, no new host.

- `river_levels`: when the host gate refuses a station in the middle of a call (`rate_limited`), the stations already
  read in that call, or found in the cache, are returned with `partial: true` and a note naming the wait (refused
  stations first in `more_matches`), as for the time budget. `rate_limited` is returned only when no station is
  available. Before, the call returned `rate_limited` and dropped what it had read (with 3 concurrent calls one got
  nothing; with 8, six did). Tests with fake timers for 3 and 8 concurrent calls and for a cached station.
- `guaira_events`: the listing (title, dates, city, link) is the complete answer and event-page details (venue, age
  rating, price) an optional enrichment. `partial: true` now means only that listing pages are missing (`truncated`),
  so a cold call is no longer always partial. Items whose event page was not read yet (time budget, the 2-page cap
  per call, a refusal) are counted in the new `details_pending` field, with a note to call again for venue and
  price. The 5 s gate, the caches and the 20 s budget are unchanged. A client that used `partial` as its signal to
  call again for event-page details should use `details_pending > 0` instead.

## 0.18.1 - 2026-11-22

Robustness fixes for the open Low findings of the last code reviews. No new tool, no new host.

- `river_levels`: an HTTP 200 answer that is not ANA's XML document (a non-XML content type, invalid or truncated
  XML, an HTML maintenance, WAF or CAPTCHA page) is now a host failure inside the host gate: the call fails with
  `source_unavailable` and the host is not asked again for 60 s (before, the station was shown `unavailable` and
  every call asked again). A page with CAPTCHA or challenge markers blocks the host for 10 minutes, as the other
  sources do. A station whose XML content cannot be read stays `unavailable` for that station only and is not asked
  again for 60 s; other stations are still read.
- `guaira_events`: the event-page details cache is capped at 500 entries; expired entries are swept and the oldest
  evicted on insert (it was an unbounded map).
- `useful_phones`: the nightly workflow now also publishes `phones/status.json` (`scripts/publish-data.sh`), and
  `useful_phones` reads it from the same copy as the phones (a local file never makes a request; a third fixed URL
  on `raw.githubusercontent.com` otherwise). When the last phones run failed, the note names its `code` (and HTTP
  status), unless that attempt is older than the numbers. The status file has a strict schema; a missing or invalid
  one adds nothing and never fails the answer. Its failures are remembered for that file only (3 s timeout), except
  a 429 or a final refusal, which stay host failures so a Retry-After is kept.
- `river_levels` and `guaira_events`: per-call time budget of 20 s (plus 1 s of slack, because slots are planned from
  the call's first request, which starts a few ms after the call). No request starts after it; what is ready is
  returned with a new output field `partial: true` and a note (`river_levels`: stations not read come first in
  `more_matches`; `guaira_events`: event pages stay `details: "not_read"`). A request already started is never cut,
  and the Guaíra listing load is never cut, so the bound is 21 s plus one request's timeout (10 s ANA, 15 s Guaíra).
  A call that joins another call's in-flight load (an ANA station, the Guaíra robots.txt) which ran out of that
  call's budget asks again under its own.
  A cold `guaira_events` call now takes about 20 s and reads one event page instead of two (about 25 s before).
- Docs: README, docs/sources.md, SECURITY.md, SPEC.md (v0.18.1 changes).

## 0.18.0 - 2026-11-22

Events and useful phones update themselves (owner request, 2026-11-22: "era pra ele pegar automático"; only if free).
New host for the server: `raw.githubusercontent.com` (two fixed files of this repository's `data` branch; robots.txt
404, checked 2026-11-22).

- New workflow `.github/workflows/collect.yml`: every night at 02:37 UTC (inside the Turismo site's robots.txt
  `Visit-time`) and on `workflow_dispatch`, on `ubuntu-latest` only (standard runner, free in public repositories),
  35-minute timeout (above the collector's 30-minute deadline), never two runs at once, `contents: write` for this job only, actions pinned by commit SHA, only
  on `Bossmann007/curitibai` `main`. It runs `scripts/publish-data.sh`: the previous files from the `data` branch go
  into a temporary `CURITIBAI_DATA_DIR`, `scripts/fetch-events.mjs` runs once unchanged (same robots.txt, window
  and 5 s rules, no retry), and only `events/events.json`, `events/status.json` and `phones/phones.json` are
  committed to the orphan branch `data` (never `main`, no force push); the commit is skipped when none changed (rare:
  `status.json` records every attempt). A failed run keeps the
  previous files, changes only `events/status.json` and ends red. The first run after merge creates the branch.
- `events_search` and `useful_phones`: the local file in `CURITIBAI_DATA_DIR` first (as before, errors included);
  else the published copy over HTTPS (fixed URLs, cached 1 hour, 2 MB / 512 KB caps, same strict schemas, fail
  closed, host gate with 60 s failure memory; HTTP 404 before the first run is `data_not_available`).
  `CURITIBAI_REMOTE_DATA=0` (or `off`) turns remote reading off. New errors for these tools: `source_unavailable`
  and `rate_limited` (published copy unreadable). `openWorldHint` is now true for both.
- `useful_phones` output gains `checked_at` (same value as `fetched_at`, kept) and `stale` (true after 3 days), and
  refuses a `checked_at` in the future (`invalid_data`), as `events_search` does. Both
  tools' notes say which copy answered; a stale published copy adds that the nightly collection may have stopped.
- Docs: README (how updating works, the public `data` branch holds facts and links only, GitHub's 60-day rule for
  scheduled workflows and how to re-enable, delayed or dropped runs, the opt-out, ten hosts), docs/sources.md,
  SECURITY.md, SPEC.md for this release. Tests: remote read path, local-first precedence, schema fail-closed, cache,
  stale, opt-out, and a check that workflows use only `ubuntu-latest` and SHA-pinned actions; the smoke test runs with
  `CURITIBAI_REMOTE_DATA=0` and also calls `useful_phones` and `events_search`.

## 0.17.0 - 2026-11-22

New tool `guaira_events`: the live public calendar of the Centro Cultural Teatro Guaíra (new host
`www.teatroguaira.pr.gov.br`; robots.txt `User-agent: *` allows `/calendario-eventos` and `/Evento/`, no crawl delay,
checked 2026-11-22; no licence found, facts and links only, Teatro Guaíra / Governo do Paraná cited, owner approval
2026-11-22).

- Input: optional `from`/`to` (default today to 30 days ahead, Curitiba time; at most 366 days), optional `text`
  (words in the title), optional `city` (default `Curitiba`, so the Cascavel tour dates are left out; `all` keeps
  every city), `limit` ≤ 50 and `offset`. Events overlapping the range, earliest first.
- Returns `title`, `start`, `end` (Curitiba local time, as listed), `city`, `state`, `link` (event page), and
  `venue`, `age_rating`, `price` read strictly from event pages (null when not read or not in a known shape; a known
  prefix followed by other text is null, never a part), with
  `details` saying which; `other_city_rows` and `truncated`. The listing's `Local` is the city, not the venue, so the
  venue needs the event page: at most 2 new event pages per call, items of the returned page only, cached 6 hours.
  Cast, directors and programme are never read.
- Requests: robots.txt first (cached 24 h; the tool stops if the calendar becomes disallowed, and reads no event page
  if `/Evento/` does), then up to 3 listing pages at fixed URLs, the whole listing cached 1 hour. At most one
  request per 5 s to the host (a request that would wait over 10 s is not made), no request for 60 s after a failure
  (a 429's Retry-After when longer, at most 1 hour), a 10-minute host block on 401/403 or a CAPTCHA (also a 200 challenge page that does not parse); never retried. A
  removed event page (404/410) is `unavailable` for that event only, without a host failure.
  A cold call makes up to 6 requests and can take about 25 s.
- Uses the shared host gate `src/hostGate.ts` from 0.16.0, which gains an optional `refusalWaitMs` (a final
  refusal remembered for the 10-minute host block; only this host sets it) and `failing()`. A 200 answer that is not
  a page of the site (a WAF or CAPTCHA page) fails inside `gate.run`, so the 60 s failure memory applies.
- New error code `layout_changed`: the listing's HTML no longer has the expected cards, dates, city or pager; nothing
  is returned.
- Docs: README (tool tables, 22 tools, hosts, licences, fixtures), docs/sources.md (robots.txt group, fields, limits,
  requests made), SPEC.md for this release (records why venue comes from event pages).

## 0.16.1 - 2026-11-22

`river_levels` is honest about data quality (owner request, 2026-11-22). No new request, no new host.

- Each station has `quality` (`ok`, `suspect`, `unknown`) and `quality_reasons`, computed only from the readings of
  the 24 h ending at the latest one that were already read. Checks: `out_of_range` (negative level, flow or rain, or
  rain over 150 mm in one reading), `level_spike` (a level jump over 100 cm in 15 minutes that comes back within an
  hour), `level_jump_unconfirmed` (that jump in the last hour, not back yet), `level_stuck` (level identical for 6 h or more
  while 10 mm or more of rain fell). `unknown` without readings or with under 8 readings (`too_few_readings`). Raw
  values are never hidden or changed; `stale` stays a separate flag.
- When a station is suspect, the note names it and says to treat its values with caution. The general note now says
  the readings are unchecked telemetry, that `quality` cannot prove a value is right, and that official flood alerts
  come from Defesa Civil and INMET (`weather_alerts`).
- Docs: a "`river_levels` data quality" section in the README, the same in short in docs/sources.md, SPEC.md
  addendum.

## 0.16.0 - 2026-11-22

New tool `river_levels` over ANA's public telemetry web service (new host `telemetriaws1.ana.gov.br`, robots.txt 404
on 2026-11-22; no licence found, facts only, ANA cited; owner approval 2026-11-22).

- Optional `station` (code, or text in the station name, river or municipality) and `near` (default Curitiba
  centre). Returns up to 3 of the 25 bundled IAT-PR stations around Curitiba, nearest first: code, name, river,
  municipality, position, latest reading time (Curitiba time), level (cm), flow (m³/s), rain of the latest reading and
  the sums over the last 1 h and 24 h, `stale` when the reading is older than 2 h, and `no_recent_data` for stations
  that sent nothing or `unavailable` when a station's answer cannot be read (never invented values). Without
  `station`, river stations come before rain gauges. Note: "Not for emergencies: Defesa Civil 199."
- The station list is bundled (built once on 2026-11-22 from `ListaEstacoesTelemetricas`), never downloaded at
  runtime. Only bundled codes and dates reach ANA.
- https is used: ANA documents plain http, but https answered with a valid certificate on 2026-11-22.
- Network: at least 5 s between request starts to the host, 15-minute cache per station, failures remembered 60 s to
  1 hour, 10-minute host block on 401/403/CAPTCHA, at most 3 stations per call. The GeoCuritiba gate moved to
  `src/hostGate.ts` and is shared (no behaviour change). The XML parser fails closed on anything unexpected (that
  station is `unavailable`; a transfer or host failure fails the call).
- Docs: README (21 tools, ten network tools, eight hosts), docs/sources.md (host, robots, licence, fields, limits,
  how the station list was built), SPEC.md for this release.

## 0.15.0 - 2026-11-22

New tool `city_facilities_search` over IPPUC's GeoCuritiba map services (new host `geocuritiba.ippuc.org.br`,
robots.txt 404 on 2026-11-21; no licence found, facts only, IPPUC cited).

- `type`: a curated subset of 26 layers named in Portuguese (feira, rua da cidadania, ecoponto, ecocidadão, câmbio
  verde, biblioteca, farol do saber, academia ao ar livre, banheiro público, cemitério, CRAS, parque, ciclovia and
  more), accents and case ignored, with aliases; `list types` returns them with no network call. Optional `bairro`,
  `near` with `radius_m` (at most 3,000 m), `limit` ≤ 50 and `offset`.
- Returns name, address, neighbourhood, regional, days and hours as published (`observacao`, one line each) and the
  `func_manha`/`func_tarde`/`func_noite`/`func_24hr` periods, institutional phones and e-mails only, `updated`
  (`dt_atualiz`), WGS84 position and distance; source "IPPUC / GeoCuritiba" with the layer URL.
- One fixed request per layer (whole layer, fixed fields, `outSR=4326`), cached 6 hours; the user's position and
  neighbourhood are never sent. Fails closed on an ArcGIS error with HTTP 200, a cut layer or another spatial
  reference. Reuses `src/http.ts` (allowlist, https only, refusal block, size cap).
- Rate and failures: at most one request per 5 s to the host per server process, across layers (a call whose turn
  is more than 10 s away gets `rate_limited` with the wait, without a request); after a failure no request for 60 s,
  or a 429's `Retry-After` when longer, at most 1 hour. An ArcGIS `error` with code 401, 403, 498 or 499 sent with
  HTTP 200 is a final refusal: the host is blocked for 10 minutes like an HTTP 403 (`blockHost`, now exported from
  `src/http.ts`).
- Privacy: text fields go through `cleanField` line by line, after masking 8 to 11 glued digits ("Tel 33334444"); phones keep Curitiba landlines and service numbers only
  (mobiles dropped), e-mails keep `curitiba.pr.gov.br` addresses only (webmail, universities, companies and other
  domains dropped); a record whose address is marked not to be shown loses its address and position.
- Docs: README (tool tables, Curitiba App comparison, privacy, limits, licences), docs/sources.md (robots result,
  fields, layer ids and counts, contact survey), SPEC.md for this release.

## 0.14.0 - 2026-11-22

New tool `useful_phones`: useful public phone numbers in Curitiba (emergencies such as SAMU, Defesa Civil and Guarda
Municipal, city services, transport, radio taxis) from the Instituto Municipal de Turismo's "Telefones Úteis" page. No
new host: the page is on `turismo.curitiba.pr.gov.br`, already read by the events collector.

- `scripts/fetch-events.mjs` reads `/conteudo/telefones-uteis/92` once per run, after the events pages, with the same
  client (window, robots.txt check, 5 s gap, deadline, User-Agent), and writes `phones/phones.json` and
  `phones/status.json` in `CURITIBAI_DATA_DIR`. It keeps only section, name and numbers as published; an unknown
  layout writes `layout_changed` and keeps the previous copy. The phones step runs only after an ok or
  `layout_changed` events result; after any other stop (an error status such as 403, 429 or 5xx, a redirect, a
  timeout, a network error, the window or the deadline) it makes no request and its status gets the same code. It
  never changes the events files; the exit code is 0 only when both steps are ok,
  and the run prints one more fixed line (`fetch-events: phones_code=... phones=N phones_dropped=N`).
- `useful_phones` (optional `query` of 2–100 characters, `limit` up to 50) reads only that local file, no network
  call; words match name, section or number, accents and case ignored. A missing file returns `data_not_available`
  with how to run the collector.
- The page read on 2026-11-22 gives 60 entries, all public bodies or companies; no personal data was found. Entries
  with a mobile number or contact-shaped text in the name are dropped and counted.
- `scripts/check-no-catalog` and `.gitignore` also block a `phones/` folder (the collector's output).

v0.13.3 review follow-ups:

- `local_csv_summary`: long values already checked clean are cached by SHA-256 when over 1,000 characters, so a
  repeated long value is not masked again. New timing guard in `scripts/verify`
  (`scripts/perf-local-csv-summary.mjs`): 2,000 distinct 8,000-character values, budget 2 s per call (measured
  median about 0.46 s with the cache, 0.73 s without, on the development Mac). README: a contact value found after the
  120-character cut also makes the column refused; the check reads the first 300 characters of a long value.
- `.github/dependabot.yml` ignores TypeScript major updates (typescript-eslint does not accept TypeScript 7 yet).
- CHANGELOG: release dates on the headings from 0.12.0 on (dates of the merge commits); the 0.13.3 sentence about
  `maskObject` now describes its real order. The URBS counts of 2026-11-20 say they were measured by hand on the
  owner's local file.

## 0.13.3 - 2026-11-21

Privacy and robustness follow-ups. No new tool, source or host.

- `local_csv_summary`: the contact-data check (CPF/CNPJ, e-mail, phone) on grouped values now runs on the whole
  value before it is cut at 120 characters. Before, a value was cut first, so a phone or e-mail split by the cut
  ("... (41) 3333-" | "4444") passed the check and its first part could be returned. A test pins a phone and an
  e-mail that straddle the cut. `maskObject` itself works in this order: it cuts the raw
  text at 2,000 characters, masks that part, then, when it cut, drops the last 400 masked characters so an
  identifier split by the 2,000 cut is never shown in part; the result is then capped at 300 characters (see
  `src/mask.ts`). `cleanField` and `guardedSummary` mask before they cut, and the header cut refuses headers over 60
  characters first.
- Final refusals (HTTP 401, 403, a CAPTCHA 429) now return `source_unavailable` with the message "the source refused
  this server; it is not asked again for 10 minutes (per host)". Other source failures are unchanged.
- `bus_departures` and `next_buses_near`: a drop in a table's times counts as the wrap past midnight only when the
  time before it is 20:00 or later and the time after it is before 04:00; any other drop no longer marks later rows
  `after_midnight`. On the 2026-11-20 file all 677 drops are of that kind, so the 993 marked rows are unchanged. The 9
  rows in that file that come after a wrap at 04:00 or later stay `after_midnight: false` (known limit, in
  docs/sources.md). These counts were measured by hand on the owner's local file of 2026-11-20.

Docs and repository files:

- README: brand header, badges, a three-line summary, a table of contents, "Quick start" (with other MCP clients) and
  "Tools at a glance" (the 18 tools grouped by area). The existing sections keep their text and move under new
  headings: "Tools" is now "Tool reference", "Run it" is now "Quick start", and the local-file guides sit under
  "Local data files" (`#tools` and `#run-it` still resolve). Every legal and licence section stays.
- README "Collection rules": the 10-minute refusal block is per host, not per path. Removal requests link to the new
  issue form.
- README and docs/sources.md, Carta de Serviços: the server never contacts www.curitiba.pr.gov.br;
  `city_services_search` reads only a copy that you save yourself, by hand, in an ordinary browser session. An
  earlier local copy (2026-11-19/20) was deleted and is not used.
- README and docs/sources.md: the `captured` and `checked_at` examples use `YYYY-MM-DD`; the
  www.curitiba.pr.gov.br row dates its facts (robots.txt read on 2026-11-19; the HTTP 403 to non-browser clients
  observed on 2026-11-19). README and CONTRIBUTING: `scripts/verify` is the required local check, and
  `.github/workflows/verify.yml` is set to run it on pull requests. The removal-request form points sensitive cases
  to the repository's private vulnerability reporting (Security tab), with no e-mail.
- New: `CONTRIBUTING.md`, `SECURITY.md`, `.github/CODEOWNERS`, a pull request template and issue forms (bug, data
  source suggestion, removal request; blank issues off).

## 0.13.2 - 2026-11-21

Legal hygiene: attribution, notices and facts only. No new tool, source or host.

- URBS bus and points-of-interest results (`urbsLicenseNote`, `city_points_search`) and the `local_csv_summary` note
  now carry the Portal de Dados Abertos de Curitiba's required sentence ("O Portal de Dados Abertos de Curitiba e o
  órgão ou entidade ... uso secundário."), as `PORTAL_LICENSE_NOTE` already did.
- `places_search`: `attribution` is now "© OpenStreetMap contributors (ODbL 1.0)" (was "© OpenStreetMap contributors,
  ODbL"), and `license_note` adds the ODbL 1.0 URI (https://opendatacommons.org/licenses/odbl/1-0/) next to the
  copyright page, for live and bundled categories.
- `weather_alerts`: the "no warning" note says the answer may lag INMET by up to 10 minutes (in-memory cache), that it
  is not an official alert service, and to follow Defesa Civil (199).
- `health_units_search`: every note ends with the emergency line the city-points tool already had ("NOT FOR
  EMERGENCIES: in an emergency call 192 (SAMU) or 193 (Corpo de Bombeiros).").
- User-Agent: the server and the events collector append the repository as contact
  (`curitibai-mcp/0.7 (+https://github.com/Bossmann007/curitibai)`, `curitibai-mcp/0.10 (+...)`). robots.txt groups are
  still matched on the `curitibai-mcp` product token.
- Events: confirmed facts only (title, dates, time, place, address, category, link). The collector never reads the
  description; a test now pins that neither `events.json` nor the detail cache holds it.
- Tests and fixtures: CPF-shaped values now have invalid check digits; a test scans every file under `test/` and
  allows only 123.456.789-09 in the two tests that check masking of a valid-looking CPF.
- README: one block on independence, names, "as is" data and emergency numbers (190/192/193/199); the comparison table
  is dated (2026-11-21, public sources) and its "extra" row loses the promotional wording; new "Privacy notice" and
  "Collection rules"; "License" becomes "Licences (code and data)" (URBS CC BY 4.0 with changes made, OSM extract as a
  separate ODbL 1.0 database, terms inherited from PNCP, INMET and CNES, fixtures with real third-party content). The
  Carta de Serviços capture text is reworded.
- `procurement_search`: the object of a credenciamento (modality 12) is withheld (`object: null`,
  `object_withheld: "may_name_a_person"`), like dispensa, inexigibilidade and inaplicabilidade.
- Masking (PNCP objects and every field that uses the same guard: events, bus stops, city points, city services,
  places): two year-like numbers joined by a space, hyphen or dot ("2025 - 2026", "2026-2027") are now masked, because
  an 8-digit phone can look like that. "2025/2026" is kept.
- `local_csv_summary`: groups need at least 5 rows to be listed (was 3); a grouped column is refused
  (`column_not_allowed`) when a value it could return would be changed by the contact-data guard (CPF/CNPJ, e-mail or
  phone shaped, or year ranges that look like phone numbers). Names of people in values are not detected.
- `vaccination_sites_search`, `next_buses_near`, `bus_departures`, `weather_forecast` and `detran_pr_info` notes say to
  confirm on the official channel before you go or act, with its URL; the README disclaimer links them.
- `src/http.ts`: HTTP 401, 403 and a 429 whose HTML page is a CAPTCHA are a final refusal (`SourceRefusedError`,
  returned as `source_unavailable`): never retried, not even by PNCP's single retry. A 429 CAPTCHA was `rate_limited`
  before. The host is then not asked again for 10 minutes in that process, and `procurement_search` and
  `health_units_search` return what they found with `next_page: null` when a later page is refused. The events
  collector already stopped on 403 (tested).
- Carta de Serviços: new local copies must be saved by a person in an ordinary browser session.
- README "Removal requests": open an issue; the content is removed from the next release.

## 0.13.1 - 2026-11-21

- Fixed: times after midnight now follow the service day. URBS files a late-night trip under the day its service
  starts, at the end of that day's table (on the 2026-11-20 file, 677 tables run from 23:xx on to 00:xx in file order,
  measured by hand on the owner's local file of 2026-11-20; see docs/sources.md). A row before 04:00 that comes after such a wrap in its table is an after-midnight row; the
  other rows before 04:00 are read as early trips of their own code's day (not verified).
- `next_buses_near`: a window past 24:00 reads the same day's after-midnight trips plus the next calendar day's early
  trips (it read the next day's code only, so Friday 23:30 missed Friday's 00:03 and showed Saturday night's trips); a
  window starting before 04:00 with an inferred day reads the previous day's after-midnight trips plus today's early
  ones. An explicit `day` is now the service day: past 24:00 the window no longer stops at 23:59 but reads that day's
  after-midnight trips; `cut_at_midnight` now means the next day's early trips were not read. Items and `windows`
  gain `after_midnight`.
- `bus_departures`: items gain `after_midnight`; the note states the rule instead of "not verified". Order and
  filters are unchanged.

## 0.13.0 - 2026-11-21

- Added `next_buses_near` ("next buses near me" in one call): the published URBS departures in the next `window_min`
  minutes (default 60, at most 180) after `at` (HH:MM, default now in Curitiba) at the stops within `radius_m` (default
  400, at most 1000) of `near`, soonest first: `time`, `day`, `minutes_from_now`, `line_code`, `line_name`,
  `directions` (every SENTIDO the stops file lists for the line at that stop: the timetable has no direction field),
  `stop_number`, `stop_name` (masked as a guard), `distance_m`, `adapt`; plus `windows`, `cut_at_midnight`,
  `stops_considered`, `stops_with_times`, `total`, `skipped_rows`. Optional `line_code` and `limit` ≤ 50 (default 20).
  `day` defaults to the code of today's weekday in Curitiba (1 Monday to Friday, 2 Saturday, 3 Sunday; inferred, and
  holidays are not detected). A window past 24:00 reads the times from 00:00 under the next calendar day's code; with
  an explicit `day` it stops at 23:59. Reuses the v0.8 readers (newest file, 5% rule, `skipped_rows`, masking, CC BY
  4.0 note, renamed-field notes) and the v0.11 stop grouping; reads `tabelaLinha`, `pontosLinha` and `linhas`; no
  network call. Timetable as published, not real-time.
- About 73 ms per call (median; the first call in a process about 135 ms) on the real 2026-11-20 files on an Apple M4.
  `scripts/verify` now times the built tool on 17,496 generated stop rows and 71,085 departures and fails above
  600 ms; the smoke test calls it over stdio.

## 0.12.0 - 2026-11-21

- Added `vaccination_sites_search`: Curitiba's public vaccination sites from the Prefeitura's "Imuniza Já" page
  (`https://imunizaja.curitiba.pr.gov.br/locaisvacinacao/`, about 100 municipal health units): `name`, `address`,
  `regional`, `hours` and `vaccines` as published, `lat`/`lon` from the page's map link (the link is never returned)
  and `distance_m` with `near`. Optional `text` (name, address/neighbourhood or regional), `vaccine` and `near`
  (nearest first; sites without coordinates are left out and counted); `limit` ≤ 50, `offset`. Output
  `{data, source_url, checked_at, attribution, license_note, note}`; `note` says the fields are untrusted third-party
  text, that the page shows no update date (confirm by phone or 156 before going) and that it is not for emergencies.
- The page is read by known element ids only; every text field is cleaned (control and format characters, NFC), masked
  and capped. A unit that does not fit is skipped and counted (`skipped_units`); no unit or more than 5% skipped is
  `source_unavailable`. One GET per call at most, parsed result cached 6 hours, 1 MB cap, 15 s timeout, HTML only,
  429 is `rate_limited`. After a failure the page is not requested again for 60 s (after a 429, the `Retry-After` wait,
  at most 1 hour).
- `imunizaja.curitiba.pr.gov.br` added to `ALLOWED_HOSTS` (robots.txt rechecked 2026-11-21: `/locaisvacinacao/` not
  disallowed). `fetchText` gained `sameHostOnly`, which refuses a redirect to any other host, and `redirectPathPrefix`, which
  refuses one outside a path (here `/locaisvacinacao`); only this tool uses them.
- docs/sources.md: the full `dadosabertos.c3sl.ufpr.br/curitiba/robots.txt` (Request-rate 1/5, Visit-time 0400-0645
  UTC, `Disallow: /`, `Allow: *.html`; root and `/curitibaurbs/` 404), rechecked 2026-11-21, and the sources evaluated
  and rejected on 2026-11-21 (stale UFPR folders, EstaR and air quality, the garbage collection form, datasets with
  personal-data risk).
- README: a "Compared with the Curitiba App" section (App Store listing, version 4.5.2 of 2026-10-06).

## 0.11.0

- Added `bus_stops_near` ("which buses stop near me"): the URBS stops within `radius_m` (default 400, at most 2000) of
  `near` (`{lat, lon}`, required), nearest first, one item per stop number: `stop_number`, `stop_name` (masked as a
  guard), `lat`, `lon`, `distance_m`, shelter `type` and `lines` (`line_code`, `line_name` from the lines file or null,
  `direction` = SENTIDO, each line and direction once). Optional `line_code` keeps only the stops that line serves (an
  unknown code is `invalid_argument`); `limit` ≤ 50 (default 20) and `offset` page over stops, with `total` and
  `next_offset`. Reads the newest `pontosLinha` and `linhas` files in `CURITIBAI_DATA_DIR/urbs/` with the v0.8 readers
  (newest file, 5% rule, `skipped_rows`, masking, CC BY 4.0 note, renamed-field notes) and the distance of
  `city_points_search`; no network call. `checked_at` is the stops file's date; `note` names the lines file when its
  date differs and says the result is not real-time (timetables via `bus_departures` with the `stop_number`).
- About 50 ms per call (median; the first call in a process about 105 ms) on the real 17,496-row 2026-11-20 stops
  file on an Apple M4. `scripts/verify` now times
  the built tool on 17,496 generated rows and fails above 400 ms; the smoke test calls it over stdio.
- The URBS `license_note` names every file a tool read (one for the other bus tools, unchanged).

## 0.10.1

Fixes so the first real nightly run of `scripts/fetch-events.mjs` can succeed (reviewer follow-ups from PR #25). The
server and `events_search` are unchanged.

- robots.txt: the whole `User-agent: *` group of `turismo.curitiba.pr.gov.br/robots.txt`, fetched once on 2026-11-21,
  is now recorded in the collector and in docs/sources.md (21 directives; 0.10.0 had a truncated Disallow list, so the
  first run would have stopped with `robots_changed`). Every run compares the whole group, order ignored and repeats
  counted: any added, removed or changed directive, `Allow` and `Crawl-delay` included, is `robots_changed`. A recorded
  `Crawl-delay` or `Request-rate` asking for more than 5 s between requests is honoured.
- robots.txt is decoded as Windows-1252 when no charset is declared: the site sends `text/plain` without a charset and
  with Latin-1 comments, which the strict UTF-8 fallback of 0.10.0 would have rejected (`layout_changed`) before any page.
- The run deadline is 30 minutes (was 10); the 05:50 UTC window end still applies. Detail pages read are kept in
  `events/details.json` with `fetched_at`, rewritten atomically after each page, so a run stopped by the deadline, the
  window or an error keeps its progress and the next run reads only the rest. `events.json` is unchanged (no
  `fetched_at`: the tool's schema is strict); the previous `events.json` is no longer used as the detail cache, so the
  first 0.10.1 run reads every detail page again.
- Details are read again when 7 days old or when the event starts on the list date or in the 3 days after it, never
  twice within 20 hours, at the same one request per 5 s. A successful run prunes the cache to the listed ids.
- Exclusive run lock `events/.lock` (created with `wx`, stale after 1 hour): a second run exits 1 with `code=locked`,
  makes no request and changes no file.
- README: how to update the recorded robots.txt rules, and why a day with no events stops with `layout_changed`
  (kept on purpose: the empty list page has never been seen).

## 0.10.0

- Added `events_search`: events in Curitiba from the public calendar of the Instituto Municipal de Turismo
  (`turismo.curitiba.pr.gov.br/eventos/`), read from `CURITIBAI_DATA_DIR/events/events.json`; no network call. Filters:
  `from`/`to` (default today to 7 days ahead, Curitiba time; events overlapping the range), `text` and `category`
  (accents and case ignored), `limit` ≤ 50 and `offset`. Returns `id`, `title`, `start_date`, `end_date`, `time`,
  `place`, `address`, `category` and `link`, with `checked_at`, `stale` (over 3 days), `attribution` and
  `license_note`; `data_not_available` when the file is missing or over 7 days old, `invalid_data` when it fails
  validation (checked with zod on every call; text fields are sanitized again). The description says every field is
  untrusted third-party text.
- Added `scripts/fetch-events.mjs`, a separate collector (Node built-ins only) that writes that file and
  `events/status.json`. Its own host allowlist (the server's `ALLOWED_HOSTS` is unchanged), requests only 02:00–05:50
  UTC, one per 5 s, 15 s timeout, 10-minute deadline, no redirects, stop without retry on any error status, robots.txt
  checked against the recorded rules on every run, two path patterns, size caps, Curitiba dates, details only for new
  ids, only the listed fields kept (link built from id and slug), Unicode control and format characters stripped, NFC,
  120-character title and place, PII mask. Atomic writes; the old file is kept and the exit code is nonzero
  (`layout_changed` or the stop code) when parsing or validation fails, the run is cut short, or the count is 0 or
  outside 0.3x–3x of the previous one. Prints fixed status lines only. The parser is built from one list and one
  detail page and the recorded robots.txt Disallow list may be incomplete: both need a live check (docs/sources.md).
- The PII mask moved from `src/sources/pncp.ts` to `src/mask.ts` (no imports, so the collector can load it); `pncp.ts`
  re-exports it, and behaviour is unchanged.
- `scripts/check-no-catalog` also fails when git tracks a file in a folder named `events` or an `.html`, `.htm`,
  `.mhtml` or `.har` file outside `test/fixtures/`; `.gitignore` ignores them.
- README: the server still writes no files; only the collector writes, inside `CURITIBAI_DATA_DIR/events/`.

## 0.9.1

- `city_points_search`: with no filter, each entry of `categories` now gives `source_categories` as `{name, count}` per URBS name instead of a list of names (a change of output shape for clients that read the names as strings), so a rename of one URBS name of a category shows as a 0 there. Such a partial rename is still not warned about in `note` (only a whole category id with no row is); README and docs/sources.md now say so (renaming BIB FAROL DO SABER would drop 45 of the 59 libraries in the 2026-11-20 file). The mixed-category line in `note` names only the categories among the matches (`cultural_space`, `special_education`, `vocational_education`).
- Bus tools: the missing-or-renamed field note says the empty or null values "may not come from URBS" (was "do not").
- Node.js: `engines` is now `>=26.13.1`, the version CI tests (`.nvmrc`); it was `>=22.12`, which no job tested. This narrows the stated support in a patch release.
- CI: added `.github/dependabot.yml` (weekly npm and GitHub Actions updates, at most 3 and 2 open PRs). Corrected the workflow and README comments: CI skips `npm audit` because it adds noise to unrelated runs, not for lack of network (0.8.2 said the latter), and a queued run on `main` is replaced by a newer push, so not every push to `main` runs.

## 0.9.0

- Added `city_points_search`: points of interest open to the public in Curitiba from URBS's points-of-interest export (`YYYY_MM_DD_pois.json`), which the user downloads into `CURITIBAI_DATA_DIR/urbs/` like the bus files; no network call. Filters: `category` (23 ids such as `feira`, `cambio_verde`, `library`, `cmei`, `municipal_school`, `bus_terminal`, `health_unit`), words in `name` (accents and case ignored), and `near` `{lat, lon}` with `radius_m` (default 1500, at most 10000), which sorts by distance and returns `distance_m`. `limit` ≤ 50 and `offset`; with no filter it lists the categories with counts. Same envelope, errors, 5% rule, `skipped_rows`, fallback hint and CC BY 4.0 `license_note` as the bus tools; `checked_at` is the file's date.
- Only an allowlist of categories is returned (mapping in docs/sources.md). Private schools and crèches, hotels, churches, supermarkets and markets, shopping centres, private clubs, newsstands, hospitals, laboratories, police and security, urban equipment and any unknown category are dropped when the file is read, before any search or count. `cultural_space`, `special_education` and `vocational_education` are open to the public but not necessarily public: they may include private or non-profit institutions (commercial cinemas, private theatres and museums, private schools), and `note` says so when any match is in one of them. When a whole category id has no row in the file, `note` says its URBS names look missing or renamed. Names and descriptions pass through the existing masking guard. `note` says the file has no days or hours (feiras included) and that the tool is not for emergencies.
- `scripts/check-no-catalog` and `.gitignore` already covered `YYYY_MM_DD_pois.json`; the comments and tests now name it.

## 0.8.2

- Bus tools: when a descriptive field is empty (or whitespace, null or absent) in every valid row of the file, `note` says the field looks missing or renamed and names the result field it feeds (`NOME_COR` → `color`, `SOMENTE_CARTAO` → `card_only`, `NOME` → `name`, `TIPO` → `type`, `GRUPO` → `group`, `PONTO` → `stop_name`, `TABELA` → `table`). The check covers the whole file, not only the rows returned. `ADAPT` keeps its 0.8.0 accessibility note.
- CI: `.github/workflows/verify.yml` runs `scripts/verify` on pull requests and on pushes to `main` (Ubuntu, Node 26.13.1 from the new `.nvmrc`, actions pinned by commit SHA, `contents: read`, no secrets, 10-minute timeout, older runs of the same ref cancelled).
- `scripts/verify`: `CURITIBAI_SKIP_AUDIT=1` skips the separate `npm audit` step (CI sets it, so `npm ci` is the only network use).

## 0.8.1

- `places_search` `police`: the result `note` and the tool description say the category is as tagged in OSM and includes Guarda Municipal, identification institutes and some non-police offices. The bundled list is unchanged.
- Licence: `package.json` `license` is now `(Apache-2.0 AND ODbL-1.0)`; `LICENSE`, the README and the `src/sources/osmBundled.ts` header point to the ODbL 1.0 text (<https://opendatacommons.org/licenses/odbl/1-0/>) for the bundled OSM list.
- Docs: corrected why police and fire stations are bundled, in the code comment and the README: `overpass.private.coffee` allowed that use but was not reachable (0.7.0 said no other free instance allowed it).

## 0.8.0

- Added `bus_lines_search`, `bus_line_stops` and `bus_departures`: Curitiba bus lines (search by name or code, accents and case ignored, and category), a line's ordered stops per direction with coordinates, and published departure times by line and/or stop, day code and time window. They read URBS daily exports (`YYYY_MM_DD_linhas.json`, `_pontosLinha.json`, `_tabelaLinha.json`) that the user downloads into `CURITIBAI_DATA_DIR/urbs/`, the newest date of each; no network call. `checked_at` is the file's date; the note warns after 30 days. Results are capped at 50 with paging.
- `bus_departures` returns URBS's DIA code as published plus an inferred `day_type` (1 weekday, 2 Saturday, 3 Sunday or holiday), and says it is inferred.
- Errors as in 0.6: `data_not_available`, `invalid_data` (not UTF-8 JSON, not a non-empty list, more than 5% of the rows invalid, or over 20 MB; the message says how to fall back to the next newest file), `file_not_allowed`, `invalid_argument`. Single invalid rows, including rows missing a field the tool filters or orders by, are skipped and counted in the note and in `data.skipped_rows`. When every timetable row has an empty ADAPT, the note says the accessibility field looks missing or renamed. Stop names pass through the existing masking guard.
- Licence: CC BY 4.0, as linked from the dataset's portal page; `license_note` credits URBS and says what was changed.
- `scripts/check-no-catalog` also fails when git tracks a dated URBS export (`YYYY_MM_DD_*.json` or `.json.xz`); `.gitignore` ignores them.

## 0.7.0

- Added `places_search`: public places in Curitiba from OpenStreetMap by a fixed category allowlist (park, library, school, community centre, town hall, bus station, marketplace), optional name words, `limit` ≤ 20 and `offset`. No shops, offices, doctors, dentists, clinics or hospitals (public health units are in `health_units_search`).
- `places_search` `police` and `fire_station`: served from a list taken once from OSM on 2026-11-21 and bundled (69 police, 10 fire stations; ODbL), with no network call, because the Overpass operator asks that no emergency or safety application depend on it and no other free instance allowed it. Results say "NOT FOR EMERGENCIES" (call 190 or 193) and warn after 180 days.
- New host `ovp.dresel.systems` (Overpass API, South America region; robots.txt 404, free, no API key). `overpass-api.de` is not used because its robots.txt disallows `/api/`; `overpass.private.coffee` was down when checked and NextGIS needs an API key. One POST per call, one request at a time, 30 s timeout, 3 MB cap; after HTTP 429 no request is sent for the Retry-After wait (capped at 1 hour).
- Every OSM result carries "© OpenStreetMap contributors, ODbL" and the OSM data timestamp (`osm3s.timestamp_osm_base`); names and other free text pass through the existing PII masking as a guard, and a `website` the guard would mask is dropped.
- User-Agent is now `curitibai-mcp/0.7` for every host.

## 0.6.0

- Added `city_services_search`: searches the Prefeitura de Curitiba service catalog (Carta de Serviços) by words (accents, case and punctuation ignored), category and online-only, with paging. It reads a local `carta-servicos.json` that the user keeps in `CURITIBAI_DATA_DIR`; the catalog is not shipped or fetched. No network call; the note warns 180 days after the file's capture date.
- New errors `data_not_available` (no data folder or no catalog file) and `invalid_data` (catalog file not UTF-8 JSON, wrong shape, or over 4 MB).
- `city_services_search` never returns links to the obituary system, non-http(s) links or links with credentials; summaries pass through the existing PII masking as a guard.

## 0.5.0

- Added `weather_forecast`: INMET's forecast for Curitiba, up to 5 days, per day and period as published (summary, min/max temperature and humidity, wind, sunrise and sunset).
- Added `weather_alerts`: INMET's active warnings that cover Curitiba (IBGE 4106902), today, upcoming or both, with INMET's text unchanged; says when there is none.
- New host `apiprevmet3.inmet.gov.br` (robots.txt 404); User-Agent `curitibai-mcp/0.5`.
- HTTP: a per-request size cap (1 MB forecast, 6 MB warnings); a body over the cap is `source_unavailable` with a message naming the cap.

## 0.4.4

- Phone masking: "tels", "telef" and "contatos" also count as contact words before a year-pair-shaped phone ("Telef. 2025-2026"); "hotel", "Excel" and "Marcel" stay readable.
- Added this changelog; docs/sources.md now describes only current behaviour.

## 0.4.3

- Phone masking: cel, telefones, whats, zap, fax and ramal also count as contact words, with an optional "." and ":" after the word ("Tel. 2025-2026").
- `detran_pr_info`: when both the year and the 180-day warnings apply, the units note gives one sentence.

## 0.4.2

- Phone masking: a year-pair-shaped phone right after a contact word (tel, fone, telefone, celular, contato, whatsapp) is masked ("tel 2025-2026").
- `detran_pr_info`: the units note warns when the bundled data is more than 180 days old.
- `procurement_search`: the note says when the scan stopped on its 15 s time budget.
- `health_units_search` and `open_datasets_search`: the rate-limit wait message is given in `note` when a later page gets HTTP 429.

## 0.4.1

- Phone masking: a DDD before 8 or 9 glued digits is masked ("41 999998888", "041 33334444"); a leading 0 in the DDD is accepted.
- Phone masking: two year-like groups ("2025 - 2026") with no DDD, "+55" or parentheses before them are kept readable (owner decision).
- `detran_pr_info`: the note now says `past` only means the Anexo I due date has passed, and quotes Portaria 907/2025 Anexo II literally.

## 0.4.0

- Added `detran_pr_info`: bundled 2026 Detran-PR licensing calendar, fee and Curitiba units, each with its source URL and check date.
- `detran_pr_info`: deadlines are marked `past` in Curitiba time and ordered by due date.

## 0.3.0

- Added `procurement_search`: PNCP procurement of Curitiba municipal bodies, with CPF/CNPJ, e-mail and phone masking in the object and no supplier data.
- Object masking hardened: Unicode dashes and invisible characters are normalised, groups may be split by spaces or spaced separators, e-mails may have spaces around "@", and the work is bounded so it stays linear.
- HTTP 429 becomes a `rate_limited` error with the wait time; a PNCP request is retried once after a connection error.
