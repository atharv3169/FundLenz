"use client";
import { useState, type Dispatch, type SetStateAction } from "react";

/** Reset pagination before rendering new results, without a second post-paint effect. */
export function useFilterPage(filterKey: string): [number, Dispatch<SetStateAction<number>>] {
  const [state, setState] = useState({ key: filterKey, page: 1 });
  const page = state.key === filterKey ? state.page : 1;
  if (state.key !== filterKey) setState({ key: filterKey, page: 1 });
  const setPage: Dispatch<SetStateAction<number>> = update => setState(previous => ({
    key: filterKey,
    page: typeof update === "function" ? update(previous.key === filterKey ? previous.page : 1) : update,
  }));
  return [page, setPage];
}
