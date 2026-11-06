import { createContext, useContext } from 'react';
import type { Model, Result } from '@/lib/atlas/model';
export const views = [
  'Overview',
  'Assumptions',
  'Forecast studio',
  'Scenarios',
  'Sensitivity',
  'Risk & reverse DCF',
  'Equity methods',
  'Research library',
  'Reports & files',
] as const;
export type View = (typeof views)[number];
export type Saved = { id: string; label: string; at: string; model: Model };
export type Desk = {
  m: Model;
  r: Result | null;
  error: string | null;
  edit: (m: Model, why: string) => void;
  go: (v: View) => void;
  notify: (s: string) => void;
  library: Saved[];
  save: (name: string) => void;
  remove: (id: string) => void;
  period: number;
  setPeriod: (n: number) => void;
};
export const AtlasContext = createContext<Desk | null>(null);
export function useAtlas() {
  const c = useContext(AtlasContext);
  if (!c) throw Error('Atlas workspace provider required');
  return c;
}
