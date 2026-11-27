/**
 * Person-name line filters for `city_facilities_search` hours lines, moved out of geocuritiba.ts in v0.76.0: the
 * maintainer and person-in-charge role lists, the work-type and community-garden person-line tests, and the
 * service-line words hourLines uses around a hidden label. The v0.72.0 and v0.76.0 rules are timed on 50 KB inputs of
 * their worst shapes in test/cityFacilities.test.ts.
 */
import { fold } from "../text.js";

/** Every CEI line naming its maintainer, owner or head, or a firm (ME, MEI, Eireli, Ltda): some are a person's name. */
export const HIDDEN_MAINTAINER_LINE = "[the maintainer line is not shown: it can carry a person's name]";
/** v0.59.0: the same lines hidden for an office (Administração Regional, COHAB), where "maintainer" is the wrong word. */
export const HIDDEN_PERSON_LINE = "[a line naming who is in charge is not shown: it can carry a person's name]";
const MAINTAINER = "mantenedor|mantid[ao]s? p(?:or|el[ao])|proprietari|responsavel|\\bdiretora?\\b|\\badministradora?\\b";
const MAINTAINER_LINE = new RegExp(`${MAINTAINER}|eireli|ltda`);
export const isMaintainerLine = (line: string): boolean => MAINTAINER_LINE.test(fold(line)) || /\bME\b/.test(line) || /\bmei\b/i.test(line);
/**
 * v0.59.0, offices (Administração Regional, COHAB): a line that starts with who is in charge, or has "<role>:"
 * anywhere ("Responsável: Fulana", "Administrador Regional: Fulano", "Diretor(a):"). Narrower than isMaintainerLine,
 * whose MEI, ME, Ltda and "responsável" anywhere rules would hide office service lines ("atendimento ao MEI").
 */
const ROLE = "responsavel|diretora?|administradora?|gerente|coordenadora?|chefe|secretario|supervisora?|gestora?";
/**
 * v0.60.0: the roles gain secretário/a, supervisor/a and gestor/a; titular, coordenação and gestão count only before
 * ':' ("Titular da conta" stays). "Secretaria" without the accent is an office ("Secretaria Municipal de …"): a role
 * only right before ':'; with the accent it is the role, read as "secretario" before folding (NFC first). "Mantido/a
 * por" anywhere hides the line (a person follows "por" with no article), and so does "mantida pelo Sr./Sra./Dona";
 * "mantida pela Associação" stays.
 */
const LABEL_ONLY = "titular|coordenacao|gestao";
/** Folded, with "secretária" (a person's role, NFC first) read as "secretario": not the office "Secretaria". */
export const roleFold = (t: string): string => fold(t.normalize("NFC").replace(/secretária/giu, "secretario"));
const PERSON_IN_CHARGE = new RegExp(
  `^[^\\p{L}]*(?:${ROLE})\\b|\\b(?:${ROLE}|${LABEL_ONLY})(?:\\(a\\))?(?: [a-z]+)?\\s*:|\\bsecretaria\\s*:` +
    `|\\bmantid[ao]s? (?:por|pel[ao] (?:sra?|senhora?|seu|dona))\\b`,
  "u",
);
export const isPersonInChargeLine = (line: string): boolean => PERSON_IN_CHARGE.test(roleFold(line));
/**
 * v0.70.0, work types (SINE, Agência do Trabalhador, Liceu, INSS): the offices' rule, or a teacher, instructor, monitor,
 * tutor, attendant or contact word anywhere in the line ("Atendimento: atendente Fulana" has it after the colon),
 * "Prof.", "Profa." and "Prof.ª" included. Broader than a role or label on purpose: a name may follow; "atendimento" is
 * not "atendente". Only these types use it.
 * v0.72.0: also docente and facilitador/a anywhere; agente and técnico/a before ':', or at the start or after an
 * article or "com/pelo/pela" when a word other than "de", "em", "para" … follows ("Técnica Fulana", "com a técnica
 * Fulana"; "aperfeiçoar técnicas", read in layer 149, and "a técnica de solda" stay; "Agentes comunitários" is hidden,
 * on the safe side). "Contato" is a person unless a channel follows: "Contato: 3350-0000" (only phones, "[masked]",
 * channel words and punctuation after the ':', then the end or hours) or "contato pelo/via/no 156, telefone, e-mail,
 * site …"; "Contato pela Fulana", "Contato via Fulano" and a bare "Contato:" (its value follows) are hidden. The value
 * of each "Atendimento:", "Atendimento ao público:" or "Horário de atendimento:" label (at the start of the line or of
 * a sentence) must read as hours (HOURS_VALUE), on the same line or, after a bare label, on the next one (`prev`);
 * otherwise the line is hidden ("Atendimento: Fulana", "Atendimento: Domingos da Silva"). Known limit: a name later
 * in an hours or channel line ("das 8h às 17h com a Fulana", "contato pelo telefone com Fulana") passes, caught only
 * by the role words.
 */
const WORK_ROLE = "professor|instrutor|monitor|orientador|educador|tutor|facilitador";
/** Words after "técnica" or "agente" that make it a noun or a description, not a person's role before a name. */
const NOT_A_NAME_NEXT = "de|do|da|dos|das|em|e|para|que|com|no|na|nos|nas|ao|aos|a|o|as|os|como";
const CONTEXT_ROLE = "tecnic[ao]s?|agentes?";
const WORK_PERSON = new RegExp(
  `\\b(?:(?:${WORK_ROLE})(?:a|es|as)?|atendentes?|docentes?|palestrantes?|assistentes? socia(?:l|is)|psicolog[ao]s?)\\b|\\bprofa?(?=[.:\\sª]|$)` +
    `|(?:^[^\\p{L}]*|\\b(?:an?|o|as|os|d[ao]s?|pel[ao]s?|n[ao]s?|com)\\s+)(?:${CONTEXT_ROLE})\\s+(?!(?:${NOT_A_NAME_NEXT})\\b)\\p{L}` +
    `|\\b(?:${CONTEXT_ROLE})(?:\\(a\\))?(?: [a-z]+)?\\s*:`,
  "u",
);
const CHANNEL_WORD = "telefones?|fones?|tel|celular|whats ?app|whats|e-?mails?|ramal|sms";
/**
 * v0.76.0: the next word is a person unless it is a unit or channel word ("da unidade", "do Sine", "com DDD"), after
 * an optional article (checked inside the lookahead, so skipping the article cannot let "a" pass as the word). No
 * capital-letter rule: folded text has none.
 */
const UNIT_WORD =
  "unidades?|agencias?|sine|liceus?|inss|central|setor|equipe|recepcao|prefeitura|secretaria|ddd|cras|creas|atendimento|ministerio|posto|ouvidoria|trabalhador";
const PERSON_NEXT = `(?!(?:(?:an?|o|as|os)\\s+)?(?:${UNIT_WORD}|${CHANNEL_WORD})\\b)\\p{L}`;
/** "WhatsApp da Fulana", "telefone com Fulana", "Falar com Fulana de Tal" (anywhere in the line). */
const NAMED_CHANNEL = new RegExp(
  `\\b(?:${CHANNEL_WORD})\\s+(?:com|d[ao]s?)\\s+${PERSON_NEXT}|\\b(?:falar|fale|tratar|procurar|procure)\\s+com\\s+${PERSON_NEXT}`,
  "u",
);
/**
 * v0.76.0: a value after "Atendimento:" made only of service phrases is not a name ("por ordem de chegada",
 * "preferencial para idosos", "gratuito", "Carteira de trabalho, seguro-desemprego", "gratuito com agendamento"):
 * phrases joined by ",", ";", "/", "e" or a space, then the end (a final "." allowed). Anything else after them
 * ("por ordem de chegada. Fulana", "gratuito pela Fulana") keeps the value a name, so the line is hidden.
 */
const SERVICE_ITEM =
  "(?:por )?ordem de chegada|(?:preferencia(?:l|is)|prioritari[ao]s?)(?: para (?:idos[ao]s|gestantes|pessoas com deficiencia|pcd))?" +
  "|gratuit[ao]s?|carteira de trabalho(?: digital)?|seguro[- ]desemprego|(?:com|mediante|por) (?:agendamento|senha|hora marcada)";
const SERVICE_VALUE = new RegExp(
  `^[-–•*\\s]*(?:${SERVICE_ITEM})(?:(?:\\s*[,;/]\\s*|\\s+e\\s+|\\s+)(?:${SERVICE_ITEM}))*\\s*\\.?\\s*$`,
);
const isServiceValue = (v: string): boolean => HOURS_VALUE.test(v) || SERVICE_VALUE.test(v);
/**
 * Hours (folded): a digit; "de/das/às/a partir de" and a digit; a weekday, its abbreviation, "dia" or "feriado" that
 * goes on as hours ("Segunda a sexta", "seg. a sex.", "Sábado, 8h", or a digit later: "Domingos da Silva" is not hours);
 * "diariamente", "todos os dias", "presencial", "online"; an appointment ("sem/com/por/mediante agendamento") or "não
 * é/há …" sentence; "fechado" at the end or before "para/temporariamente". "Somente/apenas" may come first.
 */
const DAY = "(?:segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom|feriado|dia)s?(?:-feira)?\\b";
const HOURS_BODY =
  "(?:(?:somente|apenas)\\s+)?(?:\\d|(?:d[aeo]s?|aos?|as|a partir d[aeo]s?)\\s+\\d" +
  `|(?:(?:d[aeo]s?|aos?|as|a partir d[aeo]s?|todos? os|todas as)\\s+)?${DAY}(?:\\.?\\s+(?:a|ao|as|e\\s+${DAY}|uteis)\\b|\\.?\\s*[,:;]|\\.?\\s*$|(?=.*\\d))` +
  "|diariamente\\b|todos os dias\\b|presencial\\b|on-?line\\b|(?:sem|com|por|mediante|somente com) agendamento\\b|agendamento\\b" +
  "|nao (?:e|ha|abre|funciona|atende|precisa)\\b|(?:temporariamente )?fechad[ao]s?\\s*(?:[.;,]?\\s*$|para\\b|temporariamente\\b))";
const HOURS_VALUE = new RegExp(`^[-–•*\\s]*${HOURS_BODY}`);
/**
 * After "Contato:": only phones, masked values, channel words and punctuation (one character or word per step), then
 * the end or hours that start with a word ("Contato: 3350-0000 - segunda a sexta 8h"; "Contato: 156 Fulana" is not).
 * Per line only (see isWorkPersonLine).
 */
const CONTACT_VALUE = new RegExp(
  `^\\s*[:\\-–]\\s*(?=\\S)(?:[\\d\\s()+\\-./,;:]|\\[masked\\]|(?:${CHANNEL_WORD}|ou|e)\\b)*(?:$|(?<=[\\s\\-–])(?=[a-z])${HOURS_BODY})`,
);
/** "contato pelo 156", "contato via e-mail", "contato no site": a connector, then a channel. */
const CONTACT_CHANNEL = new RegExp(
  "^\\s+(?:pel[ao]s?|por|via|atraves d[aeo]s?|n[ao]s?|em)\\s+(?:(?:o|a|um|d[ao]s?)\\s+)?" +
    `(?:\\d|\\(|\\+|\\[masked\\]|(?:${CHANNEL_WORD}|site|portal|aplicativo|app|central|internet|formulario|numero)\\b|www\\.)`,
);
const isContactPerson = (f: string): boolean => {
  for (const m of f.matchAll(/\bcontatos?\b/g)) {
    const rest = f.slice(m.index + m[0].length);
    if (!CONTACT_VALUE.test(rest) && !CONTACT_CHANNEL.test(rest)) return true;
  }
  return false;
};
/** An attendance label at the start of the line or of a sentence; its value is the rest of the line. */
const SERVICE_LABEL = /(?:^|[.;]\s+)[-–•*\s]*(?:horarios? de )?atendimento(?: ao publico| presencial)?\s*:\s*/g;
/** A line that is only that label, with or without ':' ("Atendimento"): its value is the next line. */
const BARE_SERVICE_LABEL = /^[-–•*\s]*(?:horarios? de )?atendimento(?: ao publico| presencial)?\s*:?\s*$/;
const isServiceValuePerson = (f: string, prev: string | undefined): boolean => {
  for (const m of f.matchAll(SERVICE_LABEL)) {
    const value = f.slice(m.index + m[0].length);
    if (value !== "" && !isServiceValue(value)) return true;
  }
  if (prev === undefined || BARE_SERVICE_LABEL.test(f)) return false;
  const p = fold(prev);
  const last = [...p.matchAll(SERVICE_LABEL)].pop();
  const bare = BARE_SERVICE_LABEL.test(p) || (last !== undefined && last.index + last[0].length === p.length);
  return bare && !isServiceValue(f);
};
/** `prev` null: the whole field joined (hourLines), where what follows a label is the next line, so only the words count. */
export const isWorkPersonLine = (line: string, prev?: string | null): boolean => {
  const f = fold(line);
  if (isPersonInChargeLine(line) || WORK_PERSON.test(f) || NAMED_CHANNEL.test(f)) return true;
  return prev !== null && (isContactPerson(f) || isServiceValuePerson(f, prev));
};
/**
 * v0.63.0, community gardens (run with residents): an allowlist. A line is shown only when it is one of the kinds in
 * GARDEN_LINE (a public label; an hours or number line; the body that keeps the garden, "Mantida pela Associação …";
 * the city programme; a partner; "Horta com N canteiros") or exactly "Contato pelo e-mail da secretaria", and has no
 * person in it (GARDEN_PERSON, any case: a contact, a volunteer, "quem cuida", cuidado/coordenado por or pelo/pela a
 * person, an honorific, cuida(m)/coordena(m) after anything but a body word; and isPersonInChargeLine). Any other line,
 * a lower-case name included, is hidden. Replaces the v0.60–v0.61 denylist, which a lower-case name passed. Folded
 * with roleFold, so "secretária Fulana" is a person, not the body "secretaria".
 */
const BODY = "associacao|moradores|comunidade|prefeitura|secretaria|escola|igreja|lar|smsan";
/**
 * v0.70.0: what "Parceria com" and "Programa" must name right after the keyword (and an optional ':', article or "de"),
 * else the line is of no known kind and hidden: a body, an organisation, a public scope (integrado, municipal, estadual,
 * federal), or a public company the layer named when read (2026-11-27: "Parceria com COPEL.", "Programa Integrado …
 * Eletrosul"). Generic words a name can follow (projeto, ONG, hortas) are left out, and there is no capital-letter rule
 * (a name in capitals would pass).
 */
const ENTITY =
  `${BODY}|empresa|instituto|universidade|fundacao|cooperativa|integrado|municipal|estadual|federal|copel|sanepar|eletrosul`;
const GARDEN_LINE = new RegExp(
  "^(?:" +
    [
      "(?:atendimento|horarios?|funcionamento|endereco|bairro|pomar|cultivos?|area de (?:plantio|lavoura)[a-z ]*|jardins? de mel)\\s*:",
      "(?:(?:atendimento|horarios?(?: de funcionamento)?|funcionamento)\\s*:?\\s*)?(?:(?:de|das?|aos?) )?(?:\\d|(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)s?\\b)",
      `(?:(?:mantid|coordenad|cuidad)[ao]s? pel[ao]|a coordenacao da horta e d[ao]|an?|o) (?:${BODY})\\b`,
      `(?:programa|parceria com)\\s*:?\\s*(?:(?:d[aeo]s?|an?|o|as|os) )?(?:${ENTITY})\\b`,
      "horta com \\d",
    ].join("|") +
    ")",
);
const GARDEN_CONTACT = /^contatos? pel[ao] e-?mail d[ao] secretaria\.?$/;
const GARDEN_PERSON = new RegExp(
  `\\bcontatos?\\b|\\bvoluntari|\\bquem (?:cuida|coordena)|\\b(?:coordenad|cuidad)[ao]s? (?:por\\b|pel[ao] (?!(?:${BODY})\\b))` +
    `|\\bmantid[ao]s? pel[ao] (?!(?:${ENTITY})\\b)` +
    `|\\b(?:dona|seu|sra?|senhora?)\\b\\.?\\s+[a-z]|(?<!\\b(?:${BODY}) )\\b(?:cuidam?|coordenam?)\\b`,
);
/**
 * v0.72.0: GARDEN_LINE is matched at the start of the line; a partner or programme later in the line ("Horta com 20
 * canteiros - Parceria com Fulana") must name an entity too, like one at the start, and GARDEN_PERSON hides "mantido/a
 * pelo/pela" anywhere unless an entity word follows ("…, mantida pela Fulana" is hidden; "…, mantida pela Universidade
 * Inventada" stays).
 */
const GARDEN_PARTNER = new RegExp(`^\\s*:?\\s*(?:(?:d[aeo]s?|an?|o|as|os) )?(?:${ENTITY})\\b`);
/**
 * v0.76.0: inside the partner or programme phrase (up to ".", ";" or " - "), "e", "com" or "da/do/das/dos" must be
 * followed by an entity, place or topic word: "Parceria com a comunidade e a Fulana" and "Programa Municipal da Fulana"
 * are hidden; "Universidade Federal do Paraná", "Secretaria Municipal do Meio Ambiente" and "… e Segurança Alimentar"
 * stay. A bare "de" is not checked ("Programa Municipal de Agricultura Urbana" stays).
 */
const PLACE_OR_TOPIC =
  "parana|curitiba|brasil|estado|municipio|cidade|vila|bairro|regiao|regional|jardim|meio ambiente|seguranca|" +
  "agricultura|abastecimento|alimentacao|educacao|saude|desenvolvimento|sustentabilidade";
const PARTNER_NAMED = new RegExp(
  `\\b(?:e|com|d[ao]s?)\\s+(?!(?:(?:an?|o|as|os)\\s+)?(?:${ENTITY}|${PLACE_OR_TOPIC})\\b)\\p{L}`,
  "u",
);
const hasUnknownPartner = (f: string): boolean =>
  [...f.matchAll(/\b(?:programa|parceria com)\b/g)].some((m) => {
    const rest = f.slice(m.index + m[0].length);
    return !GARDEN_PARTNER.test(rest) || PARTNER_NAMED.test(rest.split(/[.;]|\s[-–]\s/)[0] ?? "");
  });
export const isGardenPersonLine = (line: string): boolean => {
  const f = roleFold(line).replace(/^[^\p{L}\p{N}]+/u, "").trim();
  if (GARDEN_CONTACT.test(f)) return false;
  return !GARDEN_LINE.test(f) || GARDEN_PERSON.test(f) || hasUnknownPartner(f) || isPersonInChargeLine(line);
};
/** v0.54.0: only the keyword, with or without ':' ("Mantenedora", "Mantida pela:"); its value follows. */
export const MAINTAINER_LABEL = new RegExp(`^(?:${MAINTAINER})[a-z]*(?:\\(a\\))?\\s*:?$`);

/**
 * v0.60.0: a line after a CEI's "…:" label that is about the service, not a name (see hourLines `soft`): it starts
 * (after an optional dash) with a digit or a service word. Only the start counts: "Fulana de Tal, das 7h às 18h" is a
 * name.
 */
const SERVICE_PART = "atendimento|encaminhamento|funcionamento|horario|telefone|periodo|bercario|matricula|secretaria";
const SERVICE_WORD = "rua|av|avenida|fones?|vagas?";
export const SERVICE_LINE = new RegExp(`^[-\\s]*(?:\\d|integral\\b|${SERVICE_PART}|(?:${SERVICE_WORD})\\b)`);
/**
 * The rest of a split name after a hidden line is never a service line: any service word anywhere (v0.54.0 tail). Nor
 * is an hours line that starts with a weekday, goes on as one and has a digit ("Segunda a sexta, das 8h …", v0.72.0, the
 * hours after "Contato:\n3350-0000"); "Domingos da Silva" can still be the rest of a name.
 */
const WEEKDAY_START = "^(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)s?(?:-feira|\\s+(?:a|e|das?|de)\\b|\\s*[,:])(?=.*\\d)";
export const NOT_A_NAME = new RegExp(`^[-\\d]|:|^integral\\b|${WEEKDAY_START}|${SERVICE_PART}|\\b(?:${SERVICE_WORD})\\b`);
