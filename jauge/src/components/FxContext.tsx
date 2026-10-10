"use client";

import { createContext, useContext } from "react";

/** Devise d'affichage choisie par l'utilisateur et taux BCE (base EUR). */
export const FxContext = createContext<{ target: string | null; rates: Record<string, number> }>({ target: null, rates: {} });
export const useFx = () => useContext(FxContext);

export function FxProvider({ target, rates, children }: { target: string | null; rates: Record<string, number>; children: React.ReactNode }) {
  return <FxContext.Provider value={{ target, rates }}>{children}</FxContext.Provider>;
}
