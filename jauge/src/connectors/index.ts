import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";

export const CONNECTORS = [fr, es, it];
export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);
