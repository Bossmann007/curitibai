import { z } from "zod";
import { datasetUrl, getDatasetFiles, GUID_RE, PORTAL_LICENSE_NOTE } from "../sources/portal.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

export const FILES_NOTE =
  "Links only: this server does not download these files. They are served from mid-dadosabertos.curitiba.pr.gov.br, " +
  "whose robots.txt disallows automated access (Disallow: /); open them yourself in a browser.";

export const datasetFilesInput = {
  dataset_id: z
    .string()
    .trim()
    .regex(GUID_RE, "dataset_id must be the dataset GUID returned by open_datasets_search")
    .describe("Dataset id (GUID) from open_datasets_search."),
  page: z.number().int().min(1).max(100).default(1).describe("Page of the file list (50 files per page, newest first)."),
};
export const datasetFilesOutput = envelope(
  z.object({
    dataset_id: z.string(),
    title: z.string().nullable(),
    page: z.number().int(),
    total_pages: z.number().int(),
    total_files: z.number().int(),
    files: z.array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        format: z.string().nullable(),
        dictionary_url: z.string().url().nullable(),
        updated: z.string().nullable(),
        size: z.string().nullable(),
      }),
    ),
    note: z.string(),
  }),
);

export const datasetFiles: ToolDef<typeof datasetFilesInput, typeof datasetFilesOutput> = {
  name: "dataset_files",
  title: "List a Curitiba open dataset's files",
  description:
    "List the downloadable files of one Portal de Dados Abertos de Curitiba dataset: name, format, size, last update, " +
    "link and data-dictionary link. Returns the links without fetching them. Read-only.",
  inputSchema: datasetFilesInput,
  outputSchema: datasetFilesOutput,
  handler: async ({ dataset_id, page }) => {
    const id = dataset_id.toLowerCase();
    try {
      const { value, fetchedAt } = await getDatasetFiles(id, page);
      const listing = value.listing;
      return ok({
        data: {
          dataset_id: id,
          title: value.title,
          page: listing?.page ?? page,
          total_pages: listing?.total_pages ?? 0,
          total_files: listing?.total ?? 0,
          files: listing?.files ?? [],
          note: listing ? FILES_NOTE : "This dataset page offers no downloadable files.",
        },
        source_url: value.listUrl ?? datasetUrl(id),
        fetched_at: fetchedAt,
        license_note: PORTAL_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
