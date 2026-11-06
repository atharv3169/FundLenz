export type Category = "finance" | "research" | "build" | "learning";

export type PortfolioItem = {
  id: string;
  label: string;
  short: string;
  category: Category;
  year: string;
  x: number;
  y: number;
  color: string;
  headline: string;
  description: string;
  details: string[];
  tags: string[];
  metric?: string;
  metricLabel?: string;
  link?: string;
  linkLabel?: string;
};

export const items: PortfolioItem[] = [
  {
    id: "fundlenz", label: "FundLenz", short: "Flagship project", category: "finance", year: "2026 — now",
    x: 49, y: 49, color: "#b1e6cf",
    headline: "The project that started with one question.",
    description: "If I own five different funds, do I really own five different baskets of investments? FundLenz is my attempt to make that answer easier to find.",
    details: [
      "I built a finance research platform for looking beneath fund names at the holdings underneath: overlap, sector concentration, company exposure, and scenario-based stress analysis.",
      "An October 2026 catalogue snapshot held 21,389 international fund reference records, 3,372 Indian fund-name records and 31,664 security reference records. These are catalogue counts, not claims that every fund has holdings-level analysis.",
      "A worked example combined IVV, IWB and IWF into a hypothetical $100,000 portfolio. There were 951 distinct equities, but a concentration-adjusted effective holdings count of just 36.44. NVIDIA accounted for approximately 10.4% of the combined exposure.",
      "The hardest part has been dealing with incomplete holdings, stale information, validation, and making it clear what each result can and cannot say."
    ],
    tags: ["Portfolio analysis", "Investment research", "Python", "SQL", "Cloudflare", "Data quality"],
    metric: "21,389", metricLabel: "international fund references · Oct 2026",
    link: "https://fundlenz.com", linkLabel: "Explore FundLenz"
  },
  {
    id: "shyam", label: "Shyam Construction", short: "Finance & accounts", category: "finance",
    year: "2023 — 2025", x: 23, y: 29, color: "#e4c594",
    headline: "Where finance stopped being a textbook subject.",
    description: "My first real introduction to finance came from equipment purchases, loan repayments and the question of whether a good-looking investment could actually pay for itself.",
    details: [
      "As a Finance & Accounts Associate from 31 October 2023 to 26 June 2025, I worked with management and the Chartered Accountant on accounts, budgeting, tax documents, financial summaries, and financing decisions.",
      "I helped examine acquisitions of a backhoe loader and a ten-wheel commercial truck. The calculations brought together expected utilisation, loan EMIs and interest, fuel, maintenance, depreciation, resale value and cash flow.",
      "My CV describes financial models involving approximately ₹80 lakh of capital expenditure. More than the headline figure, I value the lesson: an attractive return is not useful if the business cannot meet its repayments when demand slows."
    ],
    tags: ["Capital budgeting", "Cash flow", "Debt financing", "Financial reporting", "ROI"],
    metric: "~20", metricLabel: "months of finance & accounts experience"
  },
  {
    id: "research", label: "Mutual-fund research", short: "Empirical study", category: "research",
    year: "2026", x: 19, y: 63, color: "#b6b6f0",
    headline: "I wanted to know what the liquidity numbers actually meant.",
    description: "A collaborative empirical study into fund size, reported liquidation times, and the relationship between liquidity stress and later performance in Indian small- and mid-cap mutual funds.",
    details: [
      "Working with Avika Mishra and Professor Atish Gour, we analysed roughly 1,900 fund-month observations across 70 schemes and 31 months of public stress-report information.",
      "I helped frame the research question, collect and check source data, interpret findings, and write the manuscript. Avika led the statistical work and Professor Gour guided the methods.",
      "Larger funds tended to report longer hypothetical liquidation times in the main specification. We did not find a precise negative relationship between reported liquidity stress and subsequent three-month returns.",
      "I learned as much from the limitations as from the model: public reports are not the same as actual execution costs, and correlation should not be presented as causation."
    ],
    tags: ["Mutual funds", "Liquidity risk", "Empirical research", "Financial data", "Analysis"],
    metric: "1,900", metricLabel: "fund-month observations in the study"
  },
  {
    id: "fincalc", label: "FinCalc", short: "Financial mathematics", category: "build",
    year: "2026", x: 72, y: 24, color: "#8ecce9",
    headline: "Making the formulas checkable.",
    description: "A Python calculator I built to get comfortable with the mathematics behind loans, investments and the time value of money.",
    details: [
      "FinCalc covers compound-interest future value, loan EMI and amortisation schedules, present value, and CAGR. It works through a terminal menu or command-line subcommands.",
      "It uses Decimal arithmetic, validates inputs, exports schedules to CSV and includes 30 automated tests. For a ₹100,000 loan at 12% over 12 months, the calculated monthly instalment is about ₹8,884.88.",
      "The point was not to build another calculator; it was to understand the assumptions and reproduce the result myself."
    ],
    tags: ["Python", "EMI", "Amortisation", "CAGR", "Testing"],
    metric: "30", metricLabel: "automated test cases",
    link: "https://github.com/atharv3169/FinCalc", linkLabel: "See the source"
  },
  {
    id: "dcf", label: "DCF Atlas", short: "Work in progress", category: "finance",
    year: "2026 — building", x: 85, y: 48, color: "#efbfa7",
    headline: "A deeper way to think about valuation.",
    description: "An evolving discounted-cash-flow exploration tool, designed around assumptions, scenarios, sensitivity and visual explanations rather than a single final number.",
    details: [
      "I am developing this as an extension of my interest in financial modelling: revenue drivers, margins, reinvestment, discount rates, terminal value and scenario comparisons.",
      "The project is still in development. This is a direction I am exploring, not a claim that a production-grade valuation engine has been completed."
    ],
    tags: ["DCF", "Forecasting", "Valuation", "Scenarios", "In development"]
  },
  {
    id: "crowd", label: "Crowd-monitoring system", short: "Engineering & research", category: "build",
    year: "2025 — 2026", x: 76, y: 80, color: "#e1b8e9",
    headline: "Turning an engineering idea into something testable.",
    description: "Our final-year project combined computer vision, person detection and ESP32-based alerts to explore crowd monitoring and accident prevention.",
    details: [
      "I contributed research, technical evaluation and commercial feasibility work, including cost-benefit analysis and a projected development cost of roughly ₹35,000.",
      "The team evaluated more than 15 detection scenarios. The project received a Best Project / First Place award, and I am named as a co-inventor on published Indian patent application 202621086685 A.",
      "The patent application is published, not a granted patent."
    ],
    tags: ["Computer vision", "IoT", "Cost-benefit analysis", "Research", "Patent application"]
  },
  {
    id: "internship", label: "V S Informatics", short: "Embedded & IoT internship", category: "build",
    year: "Jan — May 2026", x: 45, y: 83, color: "#a9d4ea",
    headline: "Learning to make systems work in practice.",
    description: "An embedded and IoT internship where I developed and tested more than 20 applications using Arduino, ESP32 and sensor technologies.",
    details: [
      "The work involved prototyping, system integration, debugging, and translating theoretical ideas into functioning applications.",
      "It was not a finance internship. It did, however, strengthen the analytical and technical habits I now use in finance-related projects."
    ],
    tags: ["Internship", "Arduino", "ESP32", "Debugging", "Systems"],
    metric: "20+", metricLabel: "embedded and IoT applications"
  },
  {
    id: "education", label: "B.Tech / Electronics", short: "Academic foundation", category: "learning",
    year: "2021 — 2026", x: 10, y: 84, color: "#d7d7bd",
    headline: "An engineering degree, and a growing interest in finance.",
    description: "I graduated in Electronics & Telecommunication Engineering from St. Vincent Pallotti College of Engineering & Technology, Nagpur.",
    details: [
      "My academic foundation includes applied mathematics, programming, data structures and technical problem-solving. My overall CGPA is 6.16/10.",
      "The degree was not in finance; the shift happened through actual financial work, independent research and projects I built alongside it.",
      "I scored 85/100 in HSC Mathematics & Statistics and 90/100 in school Mathematics."
    ],
    tags: ["B.Tech", "Mathematics", "Programming", "Nagpur"]
  },
  {
    id: "chegg", label: "Chegg mathematics", short: "Independent problem-solving", category: "learning",
    year: "2022 — 2023", x: 10, y: 13, color: "#ead4a8",
    headline: "A lot of problems. A lot of practice.",
    description: "I worked through applied mathematics questions for Chegg India while in college.",
    details: [
      "I completed an average of 70 mathematics solutions a month, with an average quality-control score of 5/5 according to my CV.",
      "It taught me to explain a solution, not just arrive at an answer."
    ],
    tags: ["Applied mathematics", "Problem solving", "Communication"],
    metric: "70", metricLabel: "solutions per month on average"
  },
  {
    id: "certificates", label: "Independent learning", short: "Courses & simulations", category: "learning",
    year: "2026", x: 47, y: 11, color: "#c5dba5",
    headline: "I learned a lot by following what interested me.",
    description: "Finance and technology courses helped me build a foundation and gave me ideas I could actually put to use.",
    details: [
      "Bank of America — Investment Banking job simulation / learning programme; NISM — Investor Education (Basic & Advanced).",
      "Corporate Finance Institute — Careers in Finance; HP LIFE — Basics of Finance & Cash Flow.",
      "Kaggle — Python & Intro to SQL; Vista Equity Partners — AI in Action; Simplilearn SkillUP — AI in Finance.",
      "These are independent courses, simulations and certificates, not professional licences or employment at those organisations."
    ],
    tags: ["Investor education", "Investment banking simulation", "Python", "SQL", "AI in finance"]
  },
  {
    id: "awards", label: "Awards & hackathon", short: "Recognition", category: "learning",
    year: "2024 — 2026", x: 89, y: 12, color: "#efc6a4",
    headline: "A few moments that stayed with me.",
    description: "A first-place project award, a second-place hackathon result, and the satisfaction of seeing an idea become a functioning prototype.",
    details: [
      "First Place / Best Project Award for the real-time crowd-monitoring and accident-prevention project.",
      "Second place at the interdepartmental TechNex hackathon in 2024 for Study Buddy, an app combining note management, study organisation and focus modes."
    ],
    tags: ["Best Project", "TechNex", "Study Buddy", "Teamwork"]
  },
  {
    id: "patent", label: "Published patent application", short: "Co-inventor", category: "research",
    year: "2026", x: 94, y: 78, color: "#e2b9d9",
    headline: "Research that left the classroom.",
    description: "Named co-inventor on the published Indian patent application for our real-time crowd-monitoring and accident-prevention system.",
    details: [
      "Published Indian patent application 202621086685 A, related to the final-year crowd-monitoring project.",
      "Published application does not mean the patent has been granted."
    ],
    tags: ["Innovation", "Research", "Indian patent application"],
    metric: "2026", metricLabel: "published application year"
  }
];

export const connections: [string, string][] = [
  ["fundlenz", "research"], ["fundlenz", "fincalc"], ["fundlenz", "dcf"],
  ["fundlenz", "shyam"], ["fundlenz", "education"], ["fundlenz", "certificates"],
  ["research", "shyam"], ["research", "certificates"], ["research", "patent"],
  ["fincalc", "internship"], ["fincalc", "dcf"], ["internship", "crowd"],
  ["crowd", "patent"], ["crowd", "awards"], ["education", "chegg"],
  ["education", "internship"], ["education", "awards"], ["shyam", "chegg"],
  ["certificates", "dcf"]
];

export const work = [
  {year:"2026 — now", type:"FOUNDER · FINANCE / TECHNOLOGY", title:"FundLenz", sub:"Independent project · Nagpur", text:"I started with a question about overlapping mutual-fund holdings. It gradually became a research platform for portfolio exposure, concentration and scenario analysis.", id:"fundlenz"},
  {year:"Jan — May 2026",type:"INTERNSHIP · ENGINEERING",title:"V S Informatics Pvt. Ltd.",sub:"Embedded & IoT Intern · Nagpur",text:"Built and tested embedded applications, investigated failures and learned to turn ideas into systems that actually work.",id:"internship"},
  {year:"Oct 2023 — Jun 2025",type:"FINANCE & ACCOUNTS",title:"Shyam Construction Pvt. Ltd.",sub:"Finance & Accounts Associate · Nagpur / Hyderabad",text:"Worked on accounts, budgets and machinery financing decisions. It was the first time I saw cash-flow constraints change how a business thinks.",id:"shyam"},
  {year:"2022 — 2023",type:"INDEPENDENT WORK · MATHEMATICS",title:"Chegg India",sub:"Mathematics problem solving",text:"Regularly worked through applied mathematics problems and practised explaining the reasoning behind a result.",id:"chegg"}
];

export const learning = [
  {group:"Finance & investment",names:["Investment Banking — Bank of America (simulation)","Investor Education, Basic & Advanced — NISM","Careers in Finance — Corporate Finance Institute","Basics of Finance & Cash Flow — HP LIFE"]},
  {group:"Data & technology",names:["Python — Kaggle","Intro to SQL — Kaggle","AI in Action — Vista Equity Partners","AI in Finance — Simplilearn SkillUP"]}
];

export const skillClouds = [
  {label:"Finance",skills:["Capital budgeting","Cash-flow modelling","Debt financing","Budgeting","Financial reporting","ROI","Financial feasibility"]},
  {label:"Research",skills:["Investment research","Mutual-fund analysis","Liquidity risk","Portfolio concentration","Financial data analysis","Quantitative research"]},
  {label:"Building",skills:["Python","SQL","Excel","GitHub","Cloudflare","Data validation","IoT & embedded systems"]}
];
