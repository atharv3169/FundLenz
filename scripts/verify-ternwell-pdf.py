"""Measure Chromium's physical print pages; evidence survives a failing assertion."""
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(sys.argv[1])
folios = json.loads((out / "folios.json").read_text())
pdf = out / "ternwell-report.pdf"
pages = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"]).decode()
pages = pages.rstrip("\f").split("\f")
content_order = subprocess.check_output(["pdftotext", "-raw", str(pdf), "-"]).decode().rstrip("\f").split("\f")
norm = lambda s: re.sub(r"[^a-z0-9]+", "", s.lower())
errors, metrics = [], []
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(["pdftoppm", "-r", "72", "-png", str(pdf), tmp + "/p"], check=True)
    images = sorted(Path(tmp).glob("p-*.png"), key=lambda p: int(p.stem.split("-")[1]))
    cols = min(4, len(images))
    montage = Image.new("RGB", (cols * 239, math.ceil(len(images) / cols) * 335), "#d6d2d0")
    draw = ImageDraw.Draw(montage)
    if len(images) != len(folios) or len(pages) != len(folios):
        errors.append(f"{len(folios)} report sections produced {len(images)} physical PDF pages and {len(pages)} text pages")
    for i, path in enumerate(images):
        im = Image.open(path).convert("RGB")
        w, h = im.size
        thumbnail = im.copy()
        thumbnail.thumbnail((225, 305))
        ox, oy = (i % cols) * 239 + 7, (i // cols) * 335 + 5
        montage.paste(thumbnail, (ox, oy))
        draw.text((ox, oy + 307), f"Page {i+1:02}", fill="#38303c")
        # Ignore narrow vertical borders. A band counts only if it contains
        # substantial rendered ink; a tiny header and footer cannot pass.
        body = im.convert("L").crop((int(.065*w), int(.07*h), int(.935*w), int(.94*h)))
        bw, bh = body.size
        active = sum(sum(body.crop((0, j*bh//16, bw, (j+1)*bh//16)).histogram()[:180]) > bw*.50 for j in range(16))
        raw = pages[i] if i < len(pages) else ""
        words = len(raw.split())
        f = folios[i] if i < len(folios) else {}
        metrics.append({"page": i+1, "heading": f.get("heading"), "words": words, "activeBandsOf16": active, "figures": f.get("captions",[])})
        if words < 32 or active < (7 if i == 0 else 6):
            errors.append(f"Page {i+1} mostly empty: {words} words / {active} content bands")
        if norm(f.get("heading","")) not in norm(raw):
            errors.append(f"Page {i+1} is missing expected section heading {f.get('heading')!r}")
        for caption in f.get("captions", []):
            if norm(caption) not in norm(raw) and norm(caption) not in norm(content_order[i] if i < len(content_order) else ""):
                errors.append(f"Page {i+1} missing chart label {caption!r}")
        if i==0 and len(re.findall(r"\d+[,.]?\d*",raw))<6:
            errors.append("Opening page does not contain financial figures")
    montage.save(out / "contact-sheet.png")
    # Log a compact view as well: the integrator can visually inspect all pages
    # when their GitHub connection serves job logs but not binary artifacts.
    import io, base64
    proof = io.BytesIO()
    montage.thumbnail((900,1200))
    montage.save(proof, "WEBP", quality=48)
    if out.name == "ternwell-print-review": print("TERNWELL_CONTACT_WEBP="+base64.b64encode(proof.getvalue()).decode(),flush=True)
(out / "metrics.json").write_text(json.dumps(metrics, indent=2))
print(json.dumps(metrics),flush=True)
if errors:
    raise AssertionError("; ".join(errors))
