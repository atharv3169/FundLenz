export type StoryId = "shyam" | "fundlenz" | "research" | "fincalc" | "dcf" | "crowd" | "study" | "vs" | "synk";
export type Story={ id:StoryId; title:string; type:string; year:string; eyebrow:string; hook:string; intro:string; accent:string; numbers:{value:string;label:string}[]; chapters:{title:string;paragraphs:string[]}[]; tags:string[]; visit?:{href:string;text:string;pending?:boolean} };
export const stories:Story[]=[

{
id:"shyam",title:"Shyam Construction",type:"Finance & Accounts Associate",year:"Oct 2023 – Jun 2025",eyebrow:"01 / CORPORATE FINANCE",hook:"A loan still has to be paid when the truck isn't moving.",intro:"I got interested in finance while working through real machinery purchases, repayment schedules and the question of whether a business could afford to grow.",accent:"#ddbe8b",
numbers:[{value:"~20 months",label:"finance and accounts experience"},{value:"2 assets",label:"equipment cases examined"}],
chapters:[
{title:"Where it started",paragraphs:["I joined Shyam Construction as a Finance & Accounts Associate on 31 October 2023 and worked there until 26 June 2025 alongside engineering. I helped with accounts, budgets, cost information, tax documentation and financing calculations with management and the Chartered Accountant.","The work I remember most clearly was assessing a backhoe loader and a ten-wheel commercial truck. These were practical purchase decisions, not theoretical exercises."]},
{title:"Looking beyond the purchase price",paragraphs:["I worked through loan interest and EMI schedules, projected working days, expected demand, fuel, maintenance, depreciation, resale value and possible returns. I prepared management spreadsheets so the numbers could be discussed, compared and questioned.","A good expected ROI is only part of a decision. If utilisation drops, the instalment is still due. That was the first time I really understood the difference between profit on paper and cash in the bank."]},
{title:"The scale and the lesson",paragraphs:["My CV describes modelling capital expenditure of around ₹80 lakh, alongside broader company fleet expansion and a reported 40% revenue increase. Those figures come from my CV narrative; the employer's certificate supports my equipment-analysis work and subsequent purchases but doesn't independently verify the precise fleet counts or revenue change.","I contributed analyses and summaries, while the business made its investment decisions. The experience pushed me towards corporate finance and a lasting interest in how businesses allocate capital under uncertainty."]}
],tags:["Capital budgeting","Debt financing","Cash-flow modelling","ROI","Budgeting"],visit:{href:"https://shyamconstruction.org/",text:"Visit Shyam Construction"}
},
{
id:"fundlenz",title:"FundLenz",type:"Founder · finance technology",year:"2026 – now",eyebrow:"02 / A QUESTION BECAME A PLATFORM",hook:"Five different funds can still be one concentrated bet.",intro:"I built FundLenz because I wanted to see what was really underneath the names of the funds people own.",accent:"#b8dfc5",
numbers:[{value:"951",label:"distinct equities in a worked portfolio"},{value:"21,389",label:"international fund references · Oct 2026"}],
chapters:[
{title:"Where the idea came from",paragraphs:["While researching mutual funds, I kept returning to a simple question: if I invest in several funds, how much diversification am I actually getting? Funds with different names can hold the same underlying securities.","That curiosity became FundLenz, a portfolio-research platform for examining holdings, fund overlap, sector and company concentration, and illustrative market-stress scenarios."]},
{title:"What the numbers can hide",paragraphs:["I tested a hypothetical $100,000 portfolio split between IVV, IWB and IWF. Across the disclosed holdings, it contained 951 distinct equities. Yet the concentration-adjusted effective number of holdings was roughly 36.44, with NVIDIA accounting for about 10.4% of the exposure.","The point wasn't to recommend those ETFs. It was to show how a long holdings list can disguise a small number of dominant positions."]},
{title:"The difficult part isn't drawing the graph",paragraphs:["An October 2026 snapshot indexed 21,389 international funds, 3,372 Indian fund-name records and 31,664 securities. These are catalogue figures, not a promise that all records support holdings-level analysis.","I have learned to care as much about source dates, missing holdings and validation as I do about the interface. A beautiful chart isn't worth much if it gives someone false confidence."]}
],tags:["Portfolio analysis","Overlap","Concentration","Cloudflare","Data quality"],visit:{href:"https://fundlenz.com/",text:"Explore FundLenz"}
},
{
id:"research",title:"Mutual-fund research",type:"Co-authored empirical study",year:"2026",eyebrow:"03 / INVESTMENT RESEARCH",hook:"Bigger funds. Longer liquidation times. What does that actually mean?",intro:"I helped study fund size, hypothetical liquidation times and whether reported liquidity stress explains later returns in Indian small- and mid-cap funds.",accent:"#bdb6ed",
numbers:[{value:"~1,900",label:"fund-month observations"},{value:"70",label:"fund schemes"}],
chapters:[
{title:"Starting with a useful question",paragraphs:["Our co-authored manuscript drew on 31 months of publicly disclosed stress-test information, about 1,900 fund-month observations and 70 schemes. I helped with the finance question, gathering and checking sources, interpreting results and writing the paper.","The analysis was collaborative. I don't present other contributors' statistical work as mine alone."]},
{title:"What the data did—and didn't—say",paragraphs:["In the main specification, larger funds tended to show longer modelled liquidation times. We did not find a precise negative relationship between those reported liquidity measures and the following three months of returns.","The results were sensitive to model choices. They don't identify realised trading costs, causation or a single ideal fund size. That was the most useful research lesson: knowing when not to overstate a finding."]},
{title:"What came next",paragraphs:["The completed manuscript is available as an SSRN preprint, rather than a peer-reviewed publication. I enjoyed the care required to turn public disclosures into an argument someone else could check."]}
],tags:["Mutual funds","Liquidity risk","Empirical analysis","Research methods"],visit:{href:"https://ssrn.com/abstract=7536618",text:"Read SSRN preprint"}
},

];
