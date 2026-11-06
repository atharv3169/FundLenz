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


{
id:"fincalc",title:"FinCalc",type:"Python financial mathematics",year:"2026",eyebrow:"04 / FORMULAS YOU CAN CHECK",hook:"I wanted to understand the answer, not just press calculate.",intro:"FinCalc began as a small Python exercise in the maths behind loans and investments. It turned into a project about reproducibility.",accent:"#92cce2",
numbers:[{value:"30",label:"automated test cases"},{value:"5",label:"finance calculation families"}],
chapters:[
{title:"Why build a calculator?",paragraphs:["I wanted a practical way to study compound interest, monthly loan payments, amortisation schedules, present value and CAGR. FinCalc runs from a terminal or command line, can export CSV schedules and uses Python Decimal arithmetic.","The real work was in input validation, edge cases and tests. I wrote 30 automated checks so an answer could be reproduced instead of simply trusted."]},
{title:"The financial logic",paragraphs:["For a ₹100,000 loan at 12% annual interest over 12 months, the formula returns an EMI of about ₹8,884.88. Change the tenor and the monthly payment falls, but the total interest generally grows.","The browser mini-calculator below uses the same standard fixed-rate EMI formula, recreated here as an educational demonstration. The full FinCalc has additional calculations."]}
],tags:["Python","EMI","CAGR","Amortisation","Testing"],visit:{href:"https://fundlenz.com/fincalc",text:"Open FinCalc"}
},
{
id:"dcf",title:"DCF Atlas",type:"Valuation workspace · in development",year:"2026 – building",eyebrow:"05 / UNDERSTANDING VALUE",hook:"A single target value can hide a hundred assumptions.",intro:"I'm building a more visual way to explore forecasts, discount rates, terminal values and sensitivity in company valuation.",accent:"#edb79d",
numbers:[{value:"5 years",label:"forecast in this demo"},{value:"3 drivers",label:"to experiment with"}],
chapters:[
{title:"The question behind Atlas",paragraphs:["Discounted-cash-flow models can look impressively precise even when they depend on fragile assumptions. I wanted a workspace where changing growth, margins or the discount rate makes the implications obvious.","DCF Atlas is an evolving FundLenz project around multi-year forecasts, scenarios, sensitivity surfaces and explaining how operating results translate into enterprise value."]},
{title:"Try a simplified version",paragraphs:["The mini-model below forecasts free cash flow for five years, discounts it and adds a perpetual-growth terminal value. All the inputs are hypothetical. It estimates enterprise value only, not a share price, and doesn't include the equity bridge.","The full Atlas route is planned for FundLenz, but it is not yet a production feature."]}
],tags:["DCF","FCF forecasting","Valuation","WACC","Sensitivity"],visit:{href:"https://fundlenz.com/dcf-atlas",text:"DCF Atlas · upcoming",pending:true}
},
{
id:"crowd",title:"Crowd-monitoring system",type:"Computer vision · IoT · engineering",year:"2025 – 2026",eyebrow:"06 / ENGINEERING OUTSIDE A TEXTBOOK",hook:"A camera, a microcontroller and a practical safety problem.",intro:"Our group project explored camera-based crowd detection linked to ESP32 alerts, with technical and commercial feasibility work alongside the prototype.",accent:"#dab6e5",
numbers:[{value:"15+",label:"evaluation scenarios in project work"},{value:"2026",label:"published patent application"}],
chapters:[
{title:"Turning an idea into a system",paragraphs:["The project brought together person detection and background processing, cloud or IoT communication, and ESP32-connected displays and warning indicators. We investigated whether a system could recognise crowd buildup and respond with useful alerts.","I contributed to research, feasibility and cost-benefit work, including a projected development cost around ₹35,000 and discussion of scalability and practical deployment constraints."]},
{title:"The result and the limits",paragraphs:["The project received First Place / Best Project recognition. I am named as a co-inventor on published Indian patent application 202621086685 A.","It is a published application, not a patent grant. The animated monitoring scene on this page is a conceptual visualisation, not real camera output or evidence of deployment."]}
],tags:["Computer vision","ESP32","IoT","Research","Feasibility"]
},

];
