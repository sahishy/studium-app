from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "FeatKT_MIT_URTC_poster_revised.pdf"
IEEE = Path("/var/folders/g9/h44y8rjx4g3c737f_r6kpk0m0000gn/T/codex-clipboard-89aa9288-da4e-453d-b619-085f2fd44820.png")
URTC = Path("/var/folders/g9/h44y8rjx4g3c737f_r6kpk0m0000gn/T/codex-clipboard-ce1bf731-8cac-4816-880a-263db6b0b70d.png")

W, H = 24 * 72, 36 * 72
MARGIN = 54
GAP = 28
COL_W = (W - 2 * MARGIN - GAP) / 2

NAVY = colors.HexColor("#15334D")
MIT_RED = colors.HexColor("#A31F34")
INK = colors.HexColor("#1C1C1C")
BG = colors.HexColor("#F2F2F0")
PANEL = colors.white
HILITE = colors.HexColor("#FBE9EC")
MUTED = colors.HexColor("#68747D")
ACCENT = colors.HexColor("#0E7C7B")


body = ParagraphStyle(
    "body", fontName="Helvetica", fontSize=22.5, leading=27.5,
    textColor=INK, alignment=TA_LEFT, spaceAfter=0,
)
body_center = ParagraphStyle(
    "body_center", parent=body, alignment=TA_CENTER,
)
small = ParagraphStyle(
    "small", parent=body, fontSize=18.5, leading=22.5,
)
refs_style = ParagraphStyle(
    "refs", parent=body, fontSize=16.5, leading=20.5,
)


def draw_paragraph(c, html, x, y_top, width, style=body):
    p = Paragraph(html, style)
    _, h = p.wrap(width, 10_000)
    p.drawOn(c, x, y_top - h)
    return y_top - h


def block(c, x, y_top, width, height, title):
    c.setFillColor(PANEL)
    c.roundRect(x, y_top - height, width, height, 7, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.roundRect(x, y_top - 53, width, 53, 7, fill=1, stroke=0)
    c.rect(x, y_top - 53, width, 13, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 27)
    c.drawString(x + 24, y_top - 36, title.upper())
    return x + 24, y_top - 73, width - 48


def fit_image(c, path, x, y, max_w, max_h):
    im = Image.open(path)
    iw, ih = im.size
    scale = min(max_w / iw, max_h / ih)
    c.drawImage(ImageReader(im), x, y, iw * scale, ih * scale, mask="auto")


def draw_header(c):
    header_h = 355
    y0 = H - header_h
    c.setFillColor(colors.white)
    c.rect(0, y0, W, header_h, fill=1, stroke=0)
    c.setFillColor(MIT_RED)
    c.rect(0, y0, W, 11, fill=1, stroke=0)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 72)
    c.saveState()
    c.translate(W / 2, 0)
    c.scale(0.90, 1)
    c.drawCentredString(0, H - 82, "FEATKT: FEATURE-DRIVEN GRADIENT BOOSTING")
    c.drawCentredString(0, H - 157, "FOR MULTI-STEP KNOWLEDGE TRACING")
    c.restoreState()

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 31)
    c.drawCentredString(W / 2, H - 211, "Sahishnu Durgam¹     Prajith Pandrate²")
    c.setFillColor(NAVY)
    c.setFont("Helvetica", 20)
    c.drawCentredString(
        W / 2, H - 252,
        "¹Academy of Engineering and Technology, Leesburg     ²University of Illinois Urbana-Champaign",
    )

    # Requested placement: the two marks sit at the bottom corners of the
    # compact header instead of consuming a separate top row.
    fit_image(c, IEEE, 55, y0 + 22, 240, 94)
    im = Image.open(URTC)
    iw, ih = im.size
    scale = min(175 / iw, 105 / ih)
    c.drawImage(ImageReader(im), W - 55 - iw * scale, y0 + 18,
                iw * scale, ih * scale, mask="auto")


def draw_timeline(c, x, y, width):
    cells = 10
    size = min(42, (width - 28) / cells - 7)
    gap = 7
    start = x + (width - (cells * size + (cells - 1) * gap)) / 2
    for i in range(cells):
        xx = start + i * (size + gap)
        if i < 4:
            c.setFillColor(NAVY)
            c.rect(xx, y, size, size, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(xx + size / 2, y + 13, ["1", "0", "1", "1"][i])
        else:
            c.setStrokeColor(NAVY)
            c.setDash(5, 4)
            c.rect(xx, y, size, size, fill=0, stroke=1)
            c.setDash()
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(xx + size / 2, y + 13, "?")
    cut = start + 4 * (size + gap) - gap / 2
    c.setStrokeColor(MIT_RED)
    c.setLineWidth(3)
    c.line(cut, y - 16, cut, y + size + 16)
    c.setFont("Helvetica-Bold", 17)
    c.setFillColor(MIT_RED)
    c.drawCentredString(cut, y - 37, "n = ceiling(r x L)")
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(NAVY)
    c.drawString(start, y + size + 18, "observed prefix")
    c.drawRightString(start + cells * size + (cells - 1) * gap, y + size + 18, "predicted span")


def draw_architecture(c, x, y_top, width):
    c.setFont("Helvetica-Bold", 18)
    box_h = 43
    c.setFillColor(NAVY)
    c.roundRect(x + 95, y_top - box_h, width - 190, box_h, 5, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.drawCentredString(x + width / 2, y_top - 28, "Raw EdNet-KT1 interaction")
    labels = ["Concept ID", "Difficulty", "Elapsed time", "Lag time", "Prefix accuracy"]
    bw = (width - 32) / 5
    by = y_top - 115
    for i, label in enumerate(labels):
        bx = x + i * (bw + 8)
        c.setFillColor(BG)
        c.setStrokeColor(NAVY)
        c.roundRect(bx, by, bw, 54, 4, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 14.5)
        c.drawCentredString(bx + bw / 2, by + 20, label)
    c.setFillColor(colors.HexColor("#E8EFF4"))
    c.setStrokeColor(NAVY)
    c.roundRect(x + 95, y_top - 187, width - 190, 45, 5, fill=1, stroke=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(x + width / 2, y_top - 171, "LightGBM gradient-boosted trees")
    c.setFillColor(MIT_RED)
    c.roundRect(x + 190, y_top - 251, width - 380, 42, 5, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.drawCentredString(x + width / 2, y_top - 237, "P(correct response)")


def draw_results_table(c, x, y_top, width):
    rows = [
        ("DKT", "Recurrent", "0.594"),
        ("sparseKT", "Sparse attention", "0.646"),
        ("simpleKT", "Transformer", "0.666"),
        ("AKT", "Difficulty-aware", "0.666"),
        ("Transformer + features", "Transformer", "0.726"),
        ("FeatKT", "Boosted trees", "0.747"),
    ]
    col = [0, 0.43 * width, 0.79 * width, width]
    rh = 34
    c.setFillColor(NAVY)
    c.rect(x, y_top - rh, width, rh, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(x + 10, y_top - 23, "Model")
    c.drawString(x + col[1] + 8, y_top - 23, "Type")
    c.drawRightString(x + width - 10, y_top - 23, "Avg. AUC")
    for i, (a, b, d) in enumerate(rows):
        yy = y_top - (i + 2) * rh
        c.setFillColor(HILITE if a == "FeatKT" else (colors.white if i % 2 == 0 else BG))
        c.rect(x, yy, width, rh, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold" if a == "FeatKT" else "Helvetica", 17.5)
        c.drawString(x + 10, yy + 10, a)
        c.drawString(x + col[1] + 8, yy + 10, b)
        c.drawRightString(x + width - 10, yy + 10, d)
    return y_top - (len(rows) + 1) * rh


def draw_validation_table(c, x, y_top, width):
    rows = [
        ("0.2", "0.024", "[0.014, 0.034]", "100.0%"),
        ("0.4", "0.027", "[0.018, 0.037]", "100.0%"),
        ("0.6", "0.019", "[0.014, 0.025]", "100.0%"),
        ("0.8", "0.022", "[0.014, 0.029]", "100.0%"),
        ("0.9", "0.012", "[0.006, 0.020]", "99.9%"),
    ]
    rh = 31
    xs = [x, x + 0.22 * width, x + 0.40 * width, x + 0.72 * width, x + width]
    c.setFillColor(NAVY)
    c.rect(x, y_top - rh, width, rh, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    heads = ["Prefix", "Gap", "95% CI", "Favoring FeatKT"]
    for i, h in enumerate(heads):
        c.drawCentredString((xs[i] + xs[i + 1]) / 2, y_top - 21, h)
    for i, row in enumerate(rows):
        yy = y_top - (i + 2) * rh
        c.setFillColor(colors.white if i % 2 == 0 else BG)
        c.rect(x, yy, width, rh, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica", 16.5)
        for j, value in enumerate(row):
            c.drawCentredString((xs[j] + xs[j + 1]) / 2, yy + 10, value)
    return y_top - (len(rows) + 1) * rh


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("FeatKT - IEEE MIT URTC Poster")
    c.setAuthor("Sahishnu Durgam and Prajith Pandrate")
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_header(c)

    top = H - 375
    lx = MARGIN
    rx = MARGIN + COL_W + GAP

    # LEFT COLUMN
    x, y, w = block(c, lx, top, COL_W, 430, "Introduction")
    y = draw_paragraph(c,
        "<b>Knowledge tracing (KT) predicts whether a student will answer a question correctly from their learning history.</b>",
        x, y, w)
    y -= 14
    y = draw_paragraph(c,
        "Most KT models are evaluated one step ahead: the previous answer is revealed before the next prediction. Real deployments often require predicting an entire future sequence without new feedback - for example, weekly syllabus planning or early identification of at-risk students.",
        x, y, w)
    y -= 14
    y = draw_paragraph(c,
        "pyKT calls this <b>non-accumulative multi-step (NAMS)</b> prediction [5]. Once prediction starts, a sequence model receives no new responses, making the information in the input features especially important.",
        x, y, w)

    top2 = top - 448
    x, y, w = block(c, lx, top2, COL_W, 475, "Evaluation Protocol")
    y = draw_paragraph(c,
        "For a sequence of length <i>L</i> and prefix ratio <i>r</i>, the model observes the first ceiling(<i>r x L</i>) interactions and must predict all remaining outcomes without receiving additional correctness labels.",
        x, y, w)
    draw_timeline(c, x, y - 112, w)
    y -= 190
    y = draw_paragraph(c,
        "<b>Data:</b> 5,000 EdNet-KT1 students [6], split by user into 4,000 training and 1,000 testing students. No student's interactions appeared in both sets.",
        x, y, w)
    y -= 12
    draw_paragraph(c,
        "<b>Metric:</b> AUC averaged across prefix ratios 0.2, 0.4, 0.6, 0.8, and 0.9.",
        x, y, w)

    top3 = top2 - 493
    x, y, w = block(c, lx, top3, COL_W, 740, "Proposed Model: FeatKT")
    y = draw_paragraph(c,
        "FeatKT is a LightGBM gradient-boosted decision tree model [7]. It predicts each interaction using five leakage-checked features:",
        x, y, w)
    features = [
        ("1. Concept identifier", "the concept or skill tested by the question."),
        ("2. Question difficulty", "the standardized training-set error rate for the question."),
        ("3. Log elapsed time", "log(1 + time spent answering the previous question)."),
        ("4. Log lag time", "log(1 + time between consecutive interactions)."),
        ("5. Frozen prefix accuracy", "the student's observed-prefix accuracy, calculated once at the prediction boundary and never updated using future responses."),
    ]
    for head, desc in features:
        y -= 18
        y = draw_paragraph(c, f"<b>{head}:</b> {desc}", x + 8, y, w - 8)
    y -= 24
    c.setFillColor(colors.HexColor("#E8EFF4"))
    c.roundRect(x, y - 163, w, 163, 7, fill=1, stroke=0)
    draw_paragraph(c,
        "<b>Why freeze accuracy?</b><br/>Updating this feature during prediction would require answers from the future span and violate the NAMS protocol. The frozen value preserves a student-level summary without leakage.",
        x + 20, y - 18, w - 40)
    l4 = top3 - 758
    x, y, w = block(c, lx, l4, COL_W, 435, "Selected References")
    refs = [
        "[1] A. T. Corbett and J. R. Anderson, 'Knowledge Tracing: Modeling the Acquisition of Procedural Knowledge,' <i>User Modeling and User-Adapted Interaction</i>, 1994.",
        "[2] C. Piech et al., 'Deep Knowledge Tracing,' <i>NeurIPS</i>, 2015.",
        "[3] A. Ghosh, N. Heffernan, and A. S. Lan, 'Context-Aware Attentive Knowledge Tracing,' <i>ACM KDD</i>, 2020.",
        "[4] Z. Liu et al., 'simpleKT: A Simple But Tough-to-Beat Baseline for Knowledge Tracing,' <i>ICLR</i>, 2023.",
        "[5] Z. Liu et al., 'pyKT: A Python Library to Benchmark Deep Learning Based Knowledge Tracing Models,' <i>NeurIPS</i>, 2022.",
        "[6] Y. Choi et al., 'EdNet: A Large-Scale Hierarchical Dataset in Education,' <i>AIED</i>, 2020.",
        "[7] G. Ke et al., 'LightGBM: A Highly Efficient Gradient Boosting Decision Tree,' <i>NeurIPS</i>, 2017.",
    ]
    for ref in refs:
        y = draw_paragraph(c, ref, x, y, w, refs_style)
        y -= 6

    # RIGHT COLUMN
    x, y, w = block(c, rx, top, COL_W, 405, "Architecture")
    draw_architecture(c, x, y - 2, w)
    draw_paragraph(c,
        "Each interaction is converted to the five features, scored by boosted trees, and mapped to a probability of a correct response.",
        x, y - 285, w, small)

    r2 = top - 423
    x, y, w = block(c, rx, r2, COL_W, 442, "Results")
    y2 = draw_results_table(c, x, y - 2, w)
    y2 -= 17
    draw_paragraph(c,
        "<b>FeatKT achieved the highest average AUC (0.747) and led at every prefix ratio.</b> Adding the engineered features to a transformer raised average AUC from 0.666 to 0.726, showing that the feature set itself drove most of the gain.",
        x, y2, w, small)

    r3 = r2 - 460
    x, y, w = block(c, rx, r3, COL_W, 510, "Model Validation")
    y = draw_paragraph(c,
        "A label-shuffled control achieved 0.5093 AUC, consistent with chance and providing no evidence of target leakage. A paired bootstrap over test users found a positive FeatKT advantage at every prefix ratio (<i>p</i> &lt; 0.001).",
        x, y, w, small)
    y -= 16
    y = draw_validation_table(c, x, y, w)
    y -= 14
    draw_paragraph(c,
        "Paired-bootstrap AUC gap versus the feature-matched transformer; 1,000 resamples over test users.",
        x, y, w, refs_style)

    r4 = r3 - 528
    x, y, w = block(c, rx, r4, COL_W, 753, "Conclusion")
    y = draw_paragraph(c,
        "Under NAMS prediction, input features had a greater impact on performance than model architecture. FeatKT's five features supported stronger long-horizon predictions with a simpler model.",
        x, y, w, small)
    y -= 12
    draw_paragraph(c,
        "<b>Limitations:</b> 5,000 EdNet users and one train-test split. Future work should use full EdNet, ASSISTments, additional leakage-checked features, and per-feature ablations.",
        x, y, w, small)
    c.setFillColor(HILITE)
    c.roundRect(x, r4 - 535, w, 225, 9, fill=1, stroke=0)
    c.setFillColor(MIT_RED)
    c.setFont("Helvetica-Bold", 61)
    c.drawCentredString(x + w / 2, r4 - 402, "0.747 AUC")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(x + w / 2, r4 - 454, "Highest average across all tested models")
    c.setFillColor(INK)
    c.setFont("Helvetica", 20)
    c.drawCentredString(x + w / 2, r4 - 625, "Code: github.com/sahishy/FeatKT")

    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
