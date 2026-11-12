export type StoryId = "shyam" | "fundlenz" | "dhaninfo" | "research" | "fincalc" | "dcf" | "ternwell" | "crowd" | "study" | "vs" | "synk";
export type Story={ id:StoryId; title:string; type:string; year:string; eyebrow:string; hook:string; intro:string; accent:string; numbers:{value:string;label:string}[]; chapters:{title:string;paragraphs:string[]}[]; tags:string[]; takeaway:{body:string;heading?:string}; disclosure?:string; visit?:{href:string;text:string;pending?:boolean} };
export const stories:Story[] = [
  {
    "id": "fundlenz",
    "takeaway": {
      "body": "FundLenz makes overlapping fund holdings easier to inspect by combining company and sector exposures. In the worked three-ETF example, 951 distinct equities translated to just 36.44 effective holdings after accounting for concentration."
    },
    "title": "FundLenz",
    "type": "Founder · finance technology",
    "year": "2026 – now",
    "eyebrow": "PORTFOLIO ANALYTICS",
    "hook": "951 stocks. The concentration of roughly 36 equally weighted holdings.",
    "intro": "I built FundLenz to show what an investor actually owns when several funds hold the same companies.",
    "accent": "#b8dfc5",
    "numbers": [
      {
        "value": "31,664",
        "label": "securities indexed · Oct 2026"
      },
      {
        "value": "21,389",
        "label": "international fund references · Oct 2026"
      }
    ],
    "chapters": [
      {
        "title": "Inside a portfolio",
        "paragraphs": [
          "In a hypothetical $100,000 portfolio of IVV, IWB and IWF, 951 distinct equities reduced to 36.44 effective holdings after accounting for position size. NVIDIA alone represented about 10.4%."
        ]
      },
      {
        "title": "From research to software",
        "paragraphs": [
          "FundLenz combines disclosed holdings by company and sector. Its October 2026 catalogue also indexed 3,372 Indian fund-name records. Visitors can check disclosure dates and distinguish a catalogue listing from a fund with holdings available for analysis."
        ]
      }
    ],
    "tags": [
      "Portfolio analysis",
      "Overlap",
      "Concentration",
      "Cloudflare",
      "Data quality"
    ],
    "visit": {
      "href": "https://fundlenz.com/",
      "text": "Explore FundLenz"
    }
  },
  {
    "id": "dhaninfo",
    "title": "DhanInfo",
    "type": "Senior Business Analyst",
    "year": "November 2026 – present",
    "eyebrow": "BUSINESS ANALYSIS / LENDING",
    "hook": "Business analysis across operational records, lending data and risk.",
    "intro": "At DhanInfo, I review operational information, check records and work with teams on process-related issues. My role also includes upcoming work with international clients on loan and mortgage data, financial analysis and risk.",
    "accent": "#8fd2be",
    "numbers": [
      {
        "value": "Nov ’26",
        "label": "joined as Senior Business Analyst"
      },
      {
        "value": "Global",
        "label": "international client-facing work"
      }
    ],
    "chapters": [
      {
        "title": "Working with the details",
        "paragraphs": [
          "My work covers more than one kind of analysis. I review operational information, check records for accuracy, learn how work moves between teams and follow up when something needs to be resolved. I like the part where you have to understand the process before you can trust the numbers."
        ]
      },
      {
        "title": "The lending side",
        "paragraphs": [
          "HR has also outlined work with international clients, including managing and analysing loan data, reviewing mortgage information and looking at financial risk. These responsibilities will sit alongside the broader reporting and operational work, not replace it. I'm interested in how that information is checked and used when lending decisions carry real consequences."
        ]
      }
    ],
    "tags": [
      "Business analysis",
      "Loan data",
      "Mortgage analysis",
      "Risk assessment",
      "International clients"
    ],
    "takeaway": {
      "heading": "The work ahead.",
      "body": "I'm still learning the full scope of the role. I want to get better at spotting gaps in both financial and operational data, asking the right questions and producing analysis that people can actually act on."
    },
    "disclosure": "Client information, internal workflows and non-public financial data are intentionally left out.",
    "visit": {
      "href": "https://dhaninfo.com/",
      "text": "Visit DhanInfo"
    },
    "role": "Senior Business Analyst"
  },
  {
    "id": "research",
    "takeaway": {
      "body": "The completed study examined fund liquidity disclosures alongside subsequent returns. Larger funds generally had longer modelled liquidation times, but reported liquidity stress did not reliably predict the returns that followed."
    },
    "title": "Mutual-fund research",
    "type": "Empirical research paper · Lead author",
    "year": "2026",
    "eyebrow": "INVESTMENT RESEARCH",
    "hook": "How long would an Indian equity fund need to liquidate its portfolio?",
    "intro": "I led an empirical research paper on liquidity disclosures from Indian small- and mid-cap mutual funds.",
    "accent": "#bdb6ed",
    "numbers": [
      {
        "value": "~1,900",
        "label": "fund-month observations"
      },
      {
        "value": "70",
        "label": "schemes across 31 months"
      }
    ],
    "chapters": [
      {
        "title": "The dataset",
        "paragraphs": [
          "As lead author, I framed the research question, checked public stress-test disclosures, interpreted the results and helped prepare the manuscript with the research team. We compared estimated liquidation times across funds and returns over the next three months."
        ]
      },
      {
        "title": "What we found",
        "paragraphs": [
          "Larger funds generally had longer modelled liquidation times in our main specification. Reported liquidity stress did not reliably predict subsequent returns. The manuscript is available as an SSRN preprint."
        ]
      }
    ],
    "tags": [
      "Mutual funds",
      "Liquidity risk",
      "Empirical analysis",
      "Research methods"
    ],
    "visit": {
      "href": "https://ssrn.com/abstract=7536618",
      "text": "Read SSRN preprint"
    }
  },
  {
    "id": "shyam",
    "takeaway": {
      "body": "The financing comparisons gave management a clearer view of equipment costs, loan repayments and lower-utilisation scenarios before its fleet decisions. Management made the final purchases, and company revenue grew roughly 40% during the expansion period."
    },
    "title": "Shyam Construction",
    "type": "Finance & Accounts Associate",
    "year": "Oct 2023 – Jun 2025",
    "eyebrow": "CORPORATE FINANCE",
    "hook": "Could the fleet cover its loan payments in a slow month?",
    "intro": "I modelled machinery purchases and debt repayments for a construction business expanding its fleet.",
    "accent": "#ddbe8b",
    "numbers": [
      {
        "value": "₹80 lakh",
        "label": "planned equipment investment assessed"
      },
      {
        "value": "~40%",
        "label": "company revenue growth during my tenure"
      }
    ],
    "chapters": [
      {
        "title": "The investment",
        "paragraphs": [
          "Over nearly 20 months in finance and accounts, I assessed a backhoe loader and a ten-wheel truck. Together they represented around ₹80 lakh of planned capital expenditure."
        ]
      },
      {
        "title": "The financing model",
        "paragraphs": [
          "I compared loan interest and monthly repayments against expected working days, fuel, maintenance and resale proceeds. My spreadsheets let management see how much cash each machine needed to earn when utilisation fell."
        ]
      },
      {
        "title": "The decision",
        "paragraphs": [
          "I presented the comparisons; management made the purchase and financing decisions. Company revenue grew roughly 40% during this period of fleet expansion."
        ]
      }
    ],
    "tags": [
      "Capital budgeting",
      "Debt financing",
      "Cash-flow modelling",
      "ROI",
      "Budgeting"
    ],
    "visit": {
      "href": "https://shyamconstruction.org/",
      "text": "Visit Shyam Construction"
    }
  },
  {
    "id": "dcf",
    "takeaway": {
      "body": "I finished DCF Atlas as a valuation workspace that connects operating forecasts to equity value and lets users test the assumptions behind the result with reverse DCF, sensitivity analysis and Monte Carlo simulation."
    },
    "title": "DCF Atlas",
    "type": "Equity valuation workspace",
    "year": "2026",
    "eyebrow": "EQUITY VALUATION",
    "hook": "Which assumption accounts for the price?",
    "intro": "I built DCF Atlas to connect operating forecasts to intrinsic value and test how much the answer depends on growth, margins and the cost of capital.",
    "accent": "#edb79d",
    "numbers": [
      {
        "value": "5,000",
        "label": "maximum Monte Carlo draws per run"
      },
      {
        "value": "10 years",
        "label": "maximum forecast horizon"
      }
    ],
    "chapters": [
      {
        "title": "Build a valuation",
        "paragraphs": [
          "Upload a company worksheet or start with a demonstration model. Forecast free cash flow, compare its present value with terminal value, then follow the bridge from operating value to equity value per share."
        ]
      },
      {
        "title": "Test the investment case",
        "paragraphs": [
          "Use reverse DCF to inspect what the reference price implies. The sensitivity and Monte Carlo tools show how valuation changes when assumptions move. The interactive example below illustrates the enterprise-value calculation."
        ]
      }
    ],
    "tags": [
      "DCF",
      "FCF forecasting",
      "Valuation",
      "WACC",
      "Sensitivity"
    ],
    "visit": {
      "href": "https://fundlenz.com/dcf-atlas",
      "text": "Open DCF Atlas"
    }
  },
  {
    "id": "ternwell",
    "takeaway": {
      "body": "Ternwell now brings the income statement, balance sheet and cash-flow statement into one linked model. Users can change the drivers, check the funding implications and compare scenarios before exporting the results."
    },
    "title": "Ternwell",
    "type": "Three-statement financial modelling",
    "year": "2026",
    "accent": "#d1b2ca",
    "tags": [
      "Financial modelling",
      "Working capital",
      "Funding",
      "Scenario analysis"
    ],
    "visit": {
      "href": "https://fundlenz.com/ternwell",
      "text": "Open Ternwell"
    },
    "hook": "When does a profitable business run short of cash?",
    "intro": "I built Ternwell to trace a change in sales, borrowing or working capital through the income statement, balance sheet and cash-flow statement.",
    "numbers": [
      {
        "value": "2,160",
        "label": "simulated forecast years tested"
      },
      {
        "value": "10 years",
        "label": "maximum horizon per scenario"
      }
    ],
    "chapters": [
      {
        "title": "Follow the cash",
        "paragraphs": [
          "Change a driver or edit a statement figure for a specific year. The model carries the change through the linked accounts and checks whether the statements reconcile and the company stays within its credit limit."
        ]
      },
      {
        "title": "Compare the cases",
        "paragraphs": [
          "Compare Base, Upside and Downside forecasts. Users can bring their own figures in by CSV, carry the model into an editable Excel workbook with native charts, or print a report covering all three cases."
        ]
      }
    ],
    "eyebrow": "FINANCIAL MODELLING"
  },
  {
    "id": "fincalc",
    "takeaway": {
      "body": "FinCalc delivers reproducible loan and investment calculations using decimal arithmetic, CSV amortisation schedules and automated tests. The finished tool makes monthly payments, total interest and growth assumptions straightforward to compare."
    },
    "title": "FinCalc",
    "type": "Python financial mathematics",
    "year": "2026",
    "eyebrow": "FINANCIAL MATHEMATICS",
    "hook": "What does a longer loan term actually cost?",
    "intro": "I built a Python calculator for loan repayments, investment growth and the time value of money.",
    "accent": "#92cce2",
    "numbers": [
      {
        "value": "₹100,000",
        "label": "illustrative loan principal"
      },
      {
        "value": "₹8,884.88",
        "label": "monthly payment · 12 months at 12%"
      }
    ],
    "chapters": [
      {
        "title": "Reproducible calculations",
        "paragraphs": [
          "FinCalc uses decimal arithmetic for compound interest, EMI, amortisation, present value and CAGR. It exports repayment schedules to CSV; 30 automated tests cover the calculation routines."
        ]
      },
      {
        "title": "Try the trade-off",
        "paragraphs": [
          "Change the term in the example below. A longer loan lowers the monthly payment, but at a positive fixed rate it increases the total interest paid."
        ]
      }
    ],
    "tags": [
      "Python",
      "EMI",
      "CAGR",
      "Amortisation",
      "Testing"
    ],
    "visit": {
      "href": "https://fundlenz.com/fincalc",
      "text": "Open FinCalc"
    }
  },
  {
    "id": "synk",
    "takeaway": {
      "body": "My FP&A internship brought subscription pricing, conversion and paywall assumptions into scenario-based revenue forecasts, alongside research into potential acquisitions. The case-study visuals use illustrative figures rather than confidential company data."
    },
    "title": "SYNK",
    "type": "Financial Planning and Analysis Intern · Remote",
    "year": "May – Aug 2026",
    "eyebrow": "FINANCIAL PLANNING",
    "hook": "How does a change in subscription pricing affect revenue?",
    "intro": "As a Financial Planning and Analysis Intern, I modelled monetisation scenarios for a subscription business.",
    "accent": "#b7c3ef",
    "numbers": [
      {
        "value": "FP&A",
        "label": "subscription revenue planning"
      },
      {
        "value": "M&A",
        "label": "research into strategic options"
      }
    ],
    "chapters": [
      {
        "title": "Pricing and forecasts",
        "paragraphs": [
          "I examined subscription pricing, paywall implementation and revenue projections. I built scenarios to compare how pricing and conversion assumptions changed the forecast."
        ]
      },
      {
        "title": "Strategic analysis",
        "paragraphs": [
          "I also researched potential M&A opportunities as part of the company’s longer-term financial strategy. The illustration uses no confidential company figures."
        ]
      }
    ],
    "tags": [
      "Financial planning and analysis",
      "Subscription pricing",
      "Paywall implementation",
      "Revenue projections",
      "Scenario modelling",
      "M&A research"
    ],
    "visit": {
      "href": "https://www.linkedin.com/company/synktoday/",
      "text": "SYNK company profile"
    }
  },
  {
    "id": "crowd",
    "takeaway": {
      "body": "Our team completed a camera-based crowd-monitoring prototype with alert logic. I examined feasibility, costs and scalability; the project received First Place / Best Project recognition, and I am a named co-inventor on the published Indian patent application."
    },
    "title": "Crowd-monitoring system",
    "type": "Computer vision · machine learning",
    "year": "2025 – 2026",
    "eyebrow": "COMPUTER VISION",
    "hook": "From camera input to an actionable crowd alert.",
    "intro": "For our final-year engineering project, I assessed the feasibility and cost of a camera-based crowd-monitoring prototype.",
    "accent": "#dab6e5",
    "numbers": [
      {
        "value": "₹35,000",
        "label": "development budget considered"
      },
      {
        "value": "15+",
        "label": "evaluation scenarios"
      }
    ],
    "chapters": [
      {
        "title": "The prototype",
        "paragraphs": [
          "Our team linked camera-based crowd detection to an alert system. I researched costs, assessed feasibility and examined how the design might scale beyond the prototype."
        ]
      },
      {
        "title": "Recognition",
        "paragraphs": [
          "The project received First Place / Best Project recognition. I am a named co-inventor on Indian patent application 202621086685 A, published in September 2026."
        ]
      }
    ],
    "tags": [
      "Computer vision",
      "Machine learning",
      "Crowd detection",
      "Alert logic",
      "Feasibility"
    ]
  },
  {
    "id": "vs",
    "takeaway": {
      "body": "The finished internship work combined ESP32 and Arduino applications with sensors, connectivity and motor controls. Integrating and debugging complete devices taught me to trace problems across hardware and software rather than testing components in isolation."
    },
    "title": "V S Informatics",
    "type": "Embedded & IoT internship",
    "year": "Jan – May 2026",
    "eyebrow": "EMBEDDED SYSTEMS",
    "hook": "Testing where hardware meets software.",
    "intro": "I developed and tested embedded applications using Arduino, ESP32, sensors and motor controls.",
    "accent": "#9cd0d2",
    "numbers": [
      {
        "value": "20+",
        "label": "embedded and IoT applications"
      }
    ],
    "chapters": [
      {
        "title": "At the workbench",
        "paragraphs": [
          "From January to May 2026, I integrated sensors, displays and connectivity, then traced faults across wiring and software. Testing the complete device mattered as much as testing its individual components."
        ]
      }
    ],
    "tags": [
      "Arduino",
      "ESP32",
      "Sensors",
      "Embedded systems",
      "Testing"
    ]
  },
  {
    "id": "study",
    "takeaway": {
      "body": "Our team finished a study companion combining notes, task tracking and a focus timer within the hackathon. The small browser recreation illustrates the simple workflow we chose to prioritise under a tight deadline."
    },
    "title": "Study Buddy",
    "type": "Hackathon project · group build",
    "year": "2024",
    "eyebrow": "PRODUCT DESIGN",
    "hook": "A study workspace built under a hackathon deadline.",
    "intro": "Our team combined notes, a task list and a focus timer in one study companion.",
    "accent": "#c6d8a7",
    "numbers": [
      {
        "value": "2nd place",
        "label": "interdepartmental hackathon"
      }
    ],
    "chapters": [
      {
        "title": "The build",
        "paragraphs": [
          "We chose a small set of features we could finish during the event: capture a note, choose the next task and start a timed session. The interactive recreation below runs locally in the browser."
        ]
      }
    ],
    "tags": [
      "Product design",
      "Task planning",
      "Focus",
      "Hackathon"
    ]
  }
];

export const learning=[
{title:"Finance & accounting",skills:["Corporate finance","Financial analysis","Financial accounting","Financial reporting","Financial modelling","Capital budgeting","Cash-flow analysis","Budgeting & forecasting","Financial planning & analysis (FP&A)","Debt financing","Cost-benefit & ROI analysis"]},
{title:"Investments & risk",skills:["Investment research","Portfolio analysis","Mutual-fund analysis","Risk management & assessment","Quantitative research","Financial valuation & DCF","Equity research","Capital markets","Asset management","Investment strategy"]},
{title:"Web, data & automation",skills:["UI/UX design","Responsive web design","Frontend development","Python","SQL","Microsoft Excel","Data analysis & visualisation","GitHub & version control","API integration","AI-assisted workflows & integration","Workflow automation","Cloudflare Workers","GitHub Actions","Data validation"]},
{title:"Independent learning",skills:["NISM · Investor Education","CFI · Careers in Finance","Bank of America · Investment Banking simulation","HP LIFE · Finance & Cash Flow","Kaggle · Python and SQL","Vista Equity Partners · AI in Action","Simplilearn · AI in Finance"]}
];
export const interests=["Portfolio risk","Better financial tools","What models leave out","Business investment decisions","Data that tells a story","How systems connect"];
