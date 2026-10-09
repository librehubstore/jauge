import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { be, lu, mc } from "./osm-community";

export const CONNECTORS = [fr, es, it, be, lu, mc];
export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);
