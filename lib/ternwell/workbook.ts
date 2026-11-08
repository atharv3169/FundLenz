/** A small, deterministic XLSX writer for Ternwell reports. Worksheets carry numeric formula
 * caches as well as Excel formulas so file readers need not recalculate to show the results. */
export type Cell = string | number | null | {formula:string; value:number};
export type Chart = {title:string; firstRow:number; years:string[]; series:{label:string; values:number[]}[]};
export type Sheet = {name:string; rows:Cell[][]; charts?:Chart[]};

const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG='http://schemas.openxmlformats.org/package/2006/relationships';
const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const enc=new TextEncoder();
const valid=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
function xml(s:string){
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
}
function safeText(s:string){
  valid(s.length<=32767,'Cell text exceeds Excel’s 32,767 character limit.');
  // Encode otherwise-illegal XML 1.0 control characters using SpreadsheetML’s escape.
  // Escape a literal escape prefix first so the text cannot be mistaken for a control.
  const literal=s.replace(/_x[0-9a-f]{4}_/gi,m=>'_x005F_'+m.slice(1));
  let result='';
  for(const ch of literal){const code=ch.codePointAt(0)!;
    if((code<32&&code!==9&&code!==10&&code!==13)||(code>=0xd800&&code<=0xdfff)||code===0xfffe||code===0xffff){
      result+='_x'+code.toString(16).padStart(4,'0').toUpperCase()+'_';
    }else if(code===13){result+='_x000D_';}else result+=ch;
  }
  return xml(result);
}
function column(n:number){let name='';while(n>0){const m=(n-1)%26;name=String.fromCharCode(65+m)+name;n=Math.floor((n-1)/26);}return name;}
function boundedWidth(n:number,i:number){return i===0?Math.min(54,Math.max(22,n+3)):Math.min(78,Math.max(15,n+2));}
function widthOf(c:Cell){if(c===null)return 0;if(typeof c==='string')return Math.max(...c.split(/\r\n|\r|\n/).map(v=>v.length));if(typeof c==='number')return Math.min(24,Math.max(11,String(c).length));return 14;}
function cellXml(c:Cell,row:number,col:number){
  const ref=column(col)+row;
  if(c===null)return '';
  if(typeof c==='string'){
    const style=row===1?1:col===1?2:5;
    return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+safeText(row===1&&col===1&&!c.includes('FundLenz')?'FundLenz  /  '+c:c)+'</t></is></c>';
  }
  const format=row===1?1:3;
  if(typeof c==='number'){
    valid(Number.isFinite(c),'Numbers in a workbook must be finite.');
    return '<c r="'+ref+'" s="'+format+'" t="n"><v>'+c+'</v></c>';
  }
  valid(typeof c==='object'&&c!==null&&typeof c.formula==='string'&&Number.isFinite(c.value),'Bad formula cell or cache.');
  const fx=c.formula.trim().replace(/^=/,'').trim();
  valid(!!fx&&fx.length<=8192&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(fx),'Invalid or overlong Excel formula.');
  return '<c r="'+ref+'" s="'+(row===1?1:4)+'" t="n"><f>'+xml(fx)+'</f><v>'+c.value+'</v></c>';
}
function sheetXml(sheet:Sheet){
  valid(Array.isArray(sheet.rows)&&sheet.rows.length>0&&sheet.rows.length<=1048576,'A sheet needs 1–1,048,576 rows.');
  const widths:number[]=[];const body:string[]=[];
  sheet.rows.forEach((row,idx)=>{
    valid(Array.isArray(row)&&row.length<=16384,'Too many Excel columns.');
    const cells=row.map((c,j)=>{widths[j]=Math.max(widths[j]??0,widthOf(c));return cellXml(c,idx+1,j+1);});
    body.push('<row r="'+(idx+1)+'"'+(idx===0?' ht="29" customHeight="1"':'')+'>'+cells.join('')+'</row>');
  });
  const cols=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(sheet.charts?.length?(i===0?36:16):boundedWidth(w,i))+'" customWidth="1"/>').join('');
  return XML+'<worksheet xmlns="'+NS+'" xmlns:r="'+REL+'"><dimension ref="A1:'+column(Math.max(1,widths.length))+sheet.rows.length+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="B2" sqref="B2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/>'+(cols?'<cols>'+cols+'</cols>':'')+'<sheetData>'+body.join('')+'</sheetData><pageMargins left=".3" right=".3" top=".65" bottom=".65" header=".25" footer=".25"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LFundLenz  /  Ternwell&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>'+(sheet.charts?.length?'<drawing r:id="rChart"/>':'')+'</worksheet>';
}
function styles(){
  const font=(bold:boolean,color:string,size=11)=>'<font>'+(bold?'<b/>':'')+'<sz val="'+size+'"/><color rgb="'+color+'"/><name val="Calibri"/><family val="2"/></font>';
  const fill=(c:string)=>'<fill><patternFill patternType="solid"><fgColor rgb="'+c+'"/><bgColor indexed="64"/></patternFill></fill>';
  const xf=(fontId:number,fillId:number,numFmtId:number,align:string)=>'<xf numFmtId="'+numFmtId+'" fontId="'+fontId+'" fillId="'+fillId+'" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"'+(numFmtId?' applyNumberFormat="1"':'')+'><alignment vertical="center" horizontal="'+align+'"/></xf>';
  return XML+'<styleSheet xmlns="'+NS+'"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red](#,##0.00);0.00"/></numFmts><fonts count="4">'+font(false,'FF342C36')+font(true,'FFFFFFFF',12)+font(false,'FF443749')+font(true,'FF23695F')+'</fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+fill('FF49364E')+fill('FFFAF5EB')+'</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6">'+xf(0,0,0,'general')+xf(1,2,0,'left')+xf(2,3,0,'left')+xf(0,0,164,'right')+xf(3,0,164,'right')+xf(0,0,0,'left')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c>>>1)^(c&1?0xedb88320:0);return c>>>0;});
function crc32(data:Uint8Array){let b=0xffffffff;for(const n of data)b=(b>>>8)^crcTable[(b^n)&255];return (b^0xffffffff)>>>0;}
type Part={path:string;xml:string};
function archive(parts:Part[]):Uint8Array{
  // ZIP store; CRCs, UTF-8 flag and matching central-directory offsets. A fixed
  // valid DOS date makes identical workbooks reproducible without leaking local time.
  const entries=parts.map(p=>{const bytes=enc.encode(p.xml);return {name:enc.encode(p.path),bytes,crc:crc32(bytes),offset:0};});
  let files=0,dir=0;for(const e of entries){e.offset=files;files+=30+e.name.length+e.bytes.length;dir+=46+e.name.length;}
  valid(files+dir+22<0xffffffff&&entries.length<65535,'Workbook exceeds supported ZIP size.');
  const out=new Uint8Array(files+dir+22),view=new DataView(out.buffer);let offset=0;
  const u16=(n:number)=>{view.setUint16(offset,n,true);offset+=2;},u32=(n:number)=>{view.setUint32(offset,n,true);offset+=4;},write=(v:Uint8Array)=>{out.set(v,offset);offset+=v.length;};
  const fields=(e:typeof entries[number])=>{u16(20);u16(0x0800);u16(0);u16(0);u16(33);u32(e.crc);u32(e.bytes.length);u32(e.bytes.length);u16(e.name.length);u16(0);};
  for(const e of entries){u32(0x04034b50);fields(e);write(e.name);write(e.bytes);}
  for(const e of entries){u32(0x02014b50);u16(20);fields(e);u16(0);u16(0);u16(0);u32(0);u32(e.offset);write(e.name);}
  u32(0x06054b50);u16(0);u16(0);u16(entries.length);u16(entries.length);u32(dir);u32(files);u16(0);return out;
}
export function buildWorkbook(sheets:Sheet[]):Uint8Array{
  valid(Array.isArray(sheets)&&sheets.length>0&&sheets.length<65520,'At least one worksheet is required.');
  const names=new Set<string>();for(const sheet of sheets){
    valid(typeof sheet.name==='string'&&!!sheet.name.trim()&&sheet.name.length<=31&&!/[\[\]:*?/\\\u0000-\u001f]/.test(sheet.name)&&!sheet.name.startsWith("'")&&!sheet.name.endsWith("'"),'Invalid Excel sheet name.');
    const folded=sheet.name.toLowerCase();valid(!names.has(folded),'Worksheet names must be unique.');names.add(folded);
  }
  const r=(id:string,type:string,target:string)=>'<Relationship Id="'+id+'" Type="'+REL+'/'+type+'" Target="'+target+'"/>';
  const types=XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
  const parts:Part[]=[{path:'[Content_Types].xml',xml:types},{path:'_rels/.rels',xml:XML+'<Relationships xmlns="'+PKG+'">'+r('rId1','officeDocument','xl/workbook.xml')+'</Relationships>'},
    {path:'xl/workbook.xml',xml:XML+'<workbook xmlns="'+NS+'" xmlns:r="'+REL+'"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1"/></workbook>'},
    {path:'xl/_rels/workbook.xml.rels',xml:XML+'<Relationships xmlns="'+PKG+'">'+sheets.map((_,i)=>r('rId'+(i+1),'worksheet','worksheets/sheet'+(i+1)+'.xml')).join('')+r('rId'+(sheets.length+1),'styles','styles.xml')+'</Relationships>'},
    {path:'xl/styles.xml',xml:styles()},...sheets.map((s,i)=>({path:'xl/worksheets/sheet'+(i+1)+'.xml',xml:sheetXml(s)}))];
  let extras='', counter=0;
  sheets.forEach((s,idx)=>{if(!s.charts?.length)return;const n=idx+1, rels=(body:string)=>XML+'<Relationships xmlns="'+PKG+'">'+body+'</Relationships>';parts.push({path:'xl/worksheets/_rels/sheet'+n+'.xml.rels',xml:rels(r('rChart','drawing','../drawings/drawing'+n+'.xml'))});
    let anchors='',links='';s.charts.forEach((c,j)=>{const id=++counter;const top=s.rows.length+2+Math.floor(j/2)*16, left=j%2?6:0;
      const coordinate=(tag:string,col:number,row:number)=>'<xdr:'+tag+'><xdr:col>'+col+'</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:'+tag+'>';
      anchors+='<xdr:twoCellAnchor>'+coordinate('from',left,top)+coordinate('to',left+6,top+15)+'<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="'+id+'" name="'+xml(c.title)+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="r'+id+'"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
      links+=r('r'+id,'chart','../charts/chart'+id+'.xml');parts.push({path:'xl/charts/chart'+id+'.xml',xml:chartXml(c,s.name)});extras+='<Override PartName="/xl/charts/chart'+id+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';});
    parts.push({path:'xl/drawings/drawing'+n+'.xml',xml:XML+'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="'+REL+'">'+anchors+'</xdr:wsDr>'},{path:'xl/drawings/_rels/drawing'+n+'.xml.rels',xml:rels(links)});extras+='<Override PartName="/xl/drawings/drawing'+n+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.drawing+xml"/>';});
  parts[0].xml=parts[0].xml.replace('</Types>',extras+'</Types>');return archive(parts);
}
function chartXml(c:Chart,sheet:string){
 const q="'"+sheet.replaceAll("'","''")+"'!",end=column(1+c.years.length);
 const cache=(xs:(string|number)[])=>'<c:ptCount val="'+xs.length+'"/>'+xs.map((v,i)=>'<c:pt idx="'+i+'"><c:v>'+xml(String(v))+'</c:v></c:pt>').join('');
 const series=c.series.map((s,i)=>{const row=c.firstRow+i;return '<c:ser><c:idx val="'+i+'"/><c:order val="'+i+'"/><c:tx><c:v>'+xml(s.label)+'</c:v></c:tx><c:spPr><a:ln w="30000"><a:solidFill><a:srgbClr val="'+['5D4167','22776D','BD7745'][i]+'"/></a:solidFill></a:ln></c:spPr><c:cat><c:strRef><c:f>'+q+'$B$1:$'+end+'$1</c:f><c:strCache>'+cache(c.years)+'</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'+q+'$B$'+row+':$'+end+'$'+row+'</c:f><c:numCache><c:formatCode>#,##0.0</c:formatCode>'+cache(s.values)+'</c:numCache></c:numRef></c:val></c:ser>';}).join('');
 const axis=(category:boolean)=>{const tag=category?'catAx':'valAx';return '<c:'+tag+'><c:axId val="'+(category?101:102)+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="'+(category?'b':'l')+'"/><c:crossAx val="'+(category?102:101)+'"/><c:crosses val="autoZero"/></c:'+tag+'>';};
 return XML+'<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>'+xml(c.title)+'</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/>'+series+'<c:axId val="101"/><c:axId val="102"/></c:lineChart>'+axis(true)+axis(false)+'</c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>';
}
