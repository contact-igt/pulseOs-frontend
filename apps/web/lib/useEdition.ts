"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { DEFAULT_EDITION, editionHasCapability, type Edition, type EditionCapability } from "@pulseos/types";

/**
 * The signed-in tenant's edition from the cached ["session"] query (the (app) layout loads it before any page
 * renders). This only decides what to SHOW — the API refuses gated routes regardless.
 */
export function useEdition(): Edition {
  const { data } = useQuery({ queryKey: ["session"], queryFn: api.session, retry: false });
  return data?.user.edition ?? DEFAULT_EDITION;
}

export function useCapability(capability: EditionCapability): boolean {
  return editionHasCapability(useEdition(), capability);
}
