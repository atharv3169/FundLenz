const colors=['#543c60','#167769','#ae5b30'];
const short=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
type Series={label:string;values:number[]};
export function FinancialFigure({title,years,series,unit,bars=false}:{title:string;years:number[];series:Series[];unit:string;bars?:boolean}){
 const all=series.flatMap(x=>x.values),min=Math.min(0,...all),max=Math.max(0,...all);
 const lo=min,hi=max===min?min+1:max,top=11,bottom=88,left=56,right=511;
 const y=(v:number)=>bottom-(v-lo)/(hi-lo)*(bottom-top),slot=(right-left)/years.length;
 const x=(i:number)=>bars?left+(i+.5)*slot:years.length===1?(right+left)/2:left+(right-left)*i/(years.length-1);
 const bar=Math.min(24,slot*.78/series.length),ticks=Array.from(new Set([lo,hi,(hi+lo)/2,...(lo<0&&hi>0?[0]:[])])).sort((a,b)=>a-b).filter((v,i,a)=>v===0||v===hi||v===lo||a.every(w=>w===v||Math.abs(y(w)-y(v))>12)||i===0);
 return <figure className="tr-figure"><figcaption>{title} <small>· {unit}</small></figcaption><div className="tr-figure-key">{series.map((s,j)=><span key={s.label}><i style={{backgroundColor:colors[j%3]}}/>{s.label}</span>)}</div><svg viewBox="0 0 540 114" role="img" aria-label={title+' in '+unit}><title>{title}</title>
 {ticks.map(v=><g key={v}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke={v===0?'#817782':'#ddd7dc'} strokeDasharray={v===0?undefined:'2 3'}/><text x={left-8} y={y(v)+3} fontSize="10" fill="#463a49" textAnchor="end">{short.format(v)}</text></g>)}
 {series.map((s,j)=><g key={s.label}>{!bars&&<polyline points={s.values.map((v,i)=>x(i)+','+y(v)).join(' ')} fill="none" stroke={colors[j%3]} strokeWidth="2.5" strokeDasharray={[undefined,'6 3','2 3'][j%3]}/>}
 {s.values.map((v,i)=>bars?<rect key={i} x={x(i)+(j-series.length/2)*bar} y={Math.min(y(v),y(0))} width={bar*.88} height={Math.abs(y(v)-y(0))} fill={colors[j%3]}/>:<circle key={i} cx={x(i)} cy={y(v)} r="3" fill={colors[j%3]} stroke="white" strokeWidth=".8"/>)}</g>)}
 {years.map((year,i)=><text key={year} x={x(i)} y={106} textAnchor="middle" fontSize="10" fill="#463a49">FY{String(year).slice(-2)}</text>)}</svg></figure>;
}
