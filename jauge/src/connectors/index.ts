import { ad } from "./ad";
import { at } from "./at";
import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { be, lu, mc } from "./osm-community";
import { pt } from "./pt";

export const CONNECTORS = [fr, es, it, pt, ad, at, de, be, lu, mc];
export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);
