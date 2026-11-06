"""Independent high-precision reference: consume a list of version-1 operating models on stdin."""
import json
import sys
from decimal import Decimal, localcontext

def reference(model):
    D = lambda n: Decimal(str(n))
    with localcontext() as ctx:
        ctx.prec = 48
        v = {k: D(n) for k, n in model["inputs"].items() if n is not None}
        rate = (v["wacc"] if model["discount"] == "direct" else
                (v["rf"] + v["beta"] * v["erp"]) * (1 - v["debtWeight"] / 100)
                + v["debtCost"] * (1 - v["tax"] / 100) * v["debtWeight"] / 100) / 100
        years = model["horizon"]
        revenue, losses = v["revenue"], v["nol"]
        cash_held = revenue * v["nwc"] / 100
        flows, taxes, discounted = [], [], []
        for i in range(years):
            overrides = (model["overrides"] + [{}] * years)[i]
            def annual(k):
                end = {"margin": "marginEnd", "growth": "growthEnd"}.get(k, k)
                return (D(overrides[k]) if k in overrides else
                        ((years - i - 1) * v[k] + i * v[end]) / (years - 1)) / 100
            revenue *= 1 + annual("growth")
            ebit = revenue * annual("margin")
            tax = max(D(0), ebit - losses) * v["tax"] / 100
            losses = max(D(0), losses - ebit)
            wc = revenue * annual("nwc")
            depr = revenue * annual("da")
            fcff = ebit - tax + depr - revenue * annual("capex") - (wc - cash_held)
            cash_held = wc
            exponent = D(i + 1) - (D("0.5") if model["timing"] == "midyear" else D(0))
            flows.append(fcff)
            taxes.append(tax)
            discounted.append(fcff / (1 + rate) ** exponent)
        if model["terminal"] == "multiple":
            sale = (ebit + depr) * v["multiple"]
        else:
            g = v["terminalG"] / 100
            sale = ebit * (1 - v["tax"] / 100) * (1 + g) * (1 - g / (v["roic"] / 100)) / (rate - g)
        pv = sale / (1 + rate) ** years
        firm = sum(discounted) + pv
        eq = firm + v["cash"] + v["assets"] - v["debt"] - v["claims"]
        return dict(flows=list(map(float, flows)), taxes=list(map(float,taxes)),
                    ev=float(firm), tv=float(sale), terminalPV=float(pv), perShare=float(eq / v["shares"]))

if __name__ == "__main__":
    print(json.dumps([reference(m) for m in json.load(sys.stdin)]))
