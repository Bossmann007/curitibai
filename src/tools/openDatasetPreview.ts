import { z } from "zod";
import { isAllowedUrl } from "../http.js";
import { getDatasetPreview, MAX_PREVIEW_ROWS, PORTAL_LICENSE_NOTE } from "../sources/portal.js";
import { envelope, fail, failFrom, ok, type ToolDef } from "./common.js";

export const openDatasetPreviewInput = {
  dataset_url: z
    .string()
    .trim()
    .max(500)
    .describe("Dataset detail URL on dadosabertos.curitiba.pr.gov.br (from open_datasets_search). Only https URLs on curitiba.pr.gov.br or its subdomains are accepted."),
  rows: z.number().int().min(1).max(MAX_PREVIEW_ROWS).default(10),
};
export const openDatasetPreviewOutput = envelope(
  z.object({
    title: z.string().nullable(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    note: z.string().nullable(),
  }),
);

export const openDatasetPreview: ToolDef<typeof openDatasetPreviewInput, typeof openDatasetPreviewOutput> = {
  name: "open_dataset_preview",
  title: "Preview a Curitiba open dataset",
  description:
    "First rows (max 20) of the preview table shown on a Portal de Dados Abertos de Curitiba dataset page. Cell text is returned as plain data. Read-only.",
  inputSchema: openDatasetPreviewInput,
  outputSchema: openDatasetPreviewOutput,
  handler: async ({ dataset_url, rows }) => {
    if (!isAllowedUrl(dataset_url)) return fail("url_not_allowed");
    try {
      const { value, fetchedAt } = await getDatasetPreview(dataset_url);
      return ok({
        data: { ...value.preview, rows: value.preview.rows.slice(0, rows) },
        source_url: value.url,
        fetched_at: fetchedAt,
        license_note: PORTAL_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
