import type { Metadata } from 'next';
import { AtlasWorkspace } from '@/components/atlas/workspace';
import './atlas.css';
import './overview.css';
export const metadata: Metadata = {
  title: 'DCF Atlas | FundLenz',
  description:
    'An interactive company valuation workstation: forecast cash flow, compare assumptions, model capital costs, research securities and export your work.',
};
export default function DcfAtlasPage() {
  return <AtlasWorkspace />;
}
