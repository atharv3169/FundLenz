import type { Metadata } from "next";
import { FinCalcFrame } from "@/components/fincalc-frame";

export const metadata: Metadata = {
  title: "FinCalc | Financial Calculator | FundLenz",
  description: "Explore compound interest, loan EMI and repayment schedules, investment CAGR, and present value with FinCalc by Atharva Sahu.",
};

export default function FinCalcPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f9]">
      
      <div className="mx-auto w-full max-w-[1536px]">
        <FinCalcFrame />
      </div>
    </main>
  );
}
