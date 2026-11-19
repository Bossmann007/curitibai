import { datasetFiles } from "./datasetFiles.js";
import { healthUnitsSearch } from "./healthUnitsSearch.js";
import { localCsvSummary } from "./localCsvSummary.js";
import { openDatasetsSearch } from "./openDatasetsSearch.js";
import { procurementSearch } from "./procurementSearch.js";

export const tools = [openDatasetsSearch, datasetFiles, healthUnitsSearch, procurementSearch, localCsvSummary] as const;
