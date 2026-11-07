import type {Metadata} from 'next';
import {TernwellWorkspace} from '@/components/ternwell/workspace';
import './ternwell.css';
import '@/components/ternwell/visual.css';
export const metadata: Metadata = {title:'Ternwell | FundLenz',description:'Build an integrated three-statement forecast. Link earnings, cash and capital, compare scenarios and test whether funding covers your cash needs.'};
export default function TernwellPage(){return <TernwellWorkspace/>;}
