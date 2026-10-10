import { ad } from "./ad";
import { at } from "./at";
import { de } from "./de";
import { dk } from "./dk";
import { es } from "./es";
import { fr } from "./fr";
import { hr } from "./hr";
import { it } from "./it";
import { be, lu, mc } from "./osm-community";
import { pt } from "./pt";
import { ro } from "./ro";
import { si } from "./si";

export const CONNECTORS = [fr, es, it, pt, ad, at, de, si, hr, dk, ro, be, lu, mc];
export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);
