import { datasetFiles } from "./datasetFiles.js";
import { openDatasetsSearch } from "./openDatasetsSearch.js";

export const tools = [openDatasetsSearch, datasetFiles] as const;
