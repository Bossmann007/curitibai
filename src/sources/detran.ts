/**
 * Detran-PR public facts, bundled and dated. Nothing here is fetched at run time: each value was read by hand at its
 * source URL on CHECKED_AT (see docs/sources.md). The licensing calendar changes once a year, so a past
 * CALENDAR_YEAR means the data may be outdated.
 */

export const CHECKED_AT = "2026-11-19";

export const DETRAN_UNITS_URL = "https://www.detran.pr.gov.br/unidades";
export const DETRAN_HOME_URL = "https://www.detran.pr.gov.br/";
export const PORTARIA_907_URL =
  "https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=exibir&codAto=375224";
export const LICENSING_NEWS_URL =
  "https://www.detran.pr.gov.br/Noticia/Alerta-para-placas-com-final-8-9-e-0-calendario-do-licenciamento-de-2026-esta-perto-da";

export const CALENDAR_YEAR = 2026;

/** Portaria DETRAN 907/2025, Anexo I: due date of the annual licensing by the plate's final digit (index = digit). */
export const LICENSING_DUE_DATES: readonly string[] = [
  "2026-11-27", // 0
  "2026-08-14", // 1
  "2026-08-28", // 2
  "2026-09-09", // 3
  "2026-09-18", // 4
  "2026-09-28", // 5
  "2026-10-09", // 6
  "2026-10-20", // 7
  "2026-10-30", // 8
  "2026-11-13", // 9
];

/** "O pagamento é no valor único de R$ 94,61." (news page above, 2026-10-23). */
export const LICENSING_FEE_BRL = 94.61;

export interface DetranUnit {
  kind: "CIRETRAN" | "PATRAN";
  name: string;
  city: string;
  address: string;
  phone: string;
  services: string;
}

const PATRAN_SERVICES =
  "Realizam todos os serviços de habilitação (exceto exames práticos de direção) e todos os serviços na área de veículos.";

/** The Curitiba block of /unidades: the 01ª CIRETRAN and its PATRANs, text as published. */
export const CURITIBA_UNITS: readonly DetranUnit[] = [
  {
    kind: "CIRETRAN",
    name: "01ª CIRETRAN – Curitiba",
    city: "Curitiba",
    address: "Av. Victor Ferreira do Amaral, nº 2940, Capão da Imbuia",
    phone: "0800 643 7373",
    services: "Todos os serviços do DETRAN.",
  },
  {
    kind: "PATRAN",
    name: "PATRAN – Vila Hauer",
    city: "Curitiba",
    address: "Rua Frederico Maurer, nº 1748",
    phone: "0800 643 7373",
    services: PATRAN_SERVICES,
  },
  {
    kind: "PATRAN",
    name: "PATRAN – Almirante Tamandaré",
    city: "Almirante Tamandaré",
    address: "Rua Bertolina kendrik de Oliveira, nº 681 - Centro",
    phone: "0800 643 7373",
    services: PATRAN_SERVICES,
  },
  {
    kind: "PATRAN",
    name: "PATRAN – Fazenda Rio Grande",
    city: "Fazenda Rio Grande",
    address: "Avenida Paraná, nº 1408, Pioneiros, Centro Comercial, Sala 05",
    phone: "0800 643 7373",
    services: PATRAN_SERVICES,
  },
  {
    kind: "PATRAN",
    name: "PATRAN – Rio Branco do Sul",
    city: "Rio Branco do Sul",
    address: "Rua Doutor Zoni nº 103, Centro",
    phone: "0800 643 7373",
    services: PATRAN_SERVICES,
  },
  {
    kind: "PATRAN",
    name: "PATRAN – Colombo",
    city: "Colombo",
    address: "Rua André Scrok, nº 100, São Gabriel",
    phone: "0800 643 7373",
    services: "Realiza todos os serviços nas áreas de veículo e habilitação, inclusive exames práticos de direção.",
  },
];

/** The site states two different hours; both are returned, neither is picked. */
export const HOURS_STATEMENTS: readonly { text: string; source_url: string }[] = [
  {
    text: "Atendimento presencial por agendamento: de segunda a sexta, das 8h às 16h",
    source_url: DETRAN_UNITS_URL,
  },
  {
    text: "Atendimento presencial por agendamento: de segunda a sexta, das 8h às 15h30",
    source_url: DETRAN_HOME_URL,
  },
];

/** Today's date (YYYY-MM-DD) in Curitiba's time zone. */
export function dateInCuritiba(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
