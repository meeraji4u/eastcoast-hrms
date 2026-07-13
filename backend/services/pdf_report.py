import io
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable, KeepTogether)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

BRAND    = colors.HexColor("#0f4c81")
ACCENT   = colors.HexColor("#1a73e8")
LIGHT    = colors.HexColor("#e8f0fe")
MID      = colors.HexColor("#c5d8f8")
GRAY_BG  = colors.HexColor("#f8fafc")
GRAY_TXT = colors.HexColor("#64748b")
RED      = colors.HexColor("#dc2626")
GREEN    = colors.HexColor("#16a34a")
AMBER    = colors.HexColor("#d97706")

def generate_monthly_pdf(summary: dict, emp_name: str, company: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
        leftMargin=12*mm, rightMargin=12*mm,
        topMargin=14*mm, bottomMargin=12*mm)

    s = getSampleStyleSheet()
    title_s  = ParagraphStyle("T", fontName="Helvetica-Bold", fontSize=18,
                               textColor=BRAND, alignment=TA_LEFT)
    sub_s    = ParagraphStyle("S", fontName="Helvetica", fontSize=9,
                               textColor=GRAY_TXT, alignment=TA_LEFT)
    right_s  = ParagraphStyle("R", fontName="Helvetica", fontSize=8,
                               textColor=GRAY_TXT, alignment=TA_RIGHT)
    dept_s   = ParagraphStyle("D", fontName="Helvetica-Bold", fontSize=8,
                               textColor=BRAND)

    elems = []

    # Header
    header_data = [[
        Paragraph(f"<b>EastCoast HRMS</b>", title_s),
        Paragraph(f"Monthly Attendance Report<br/>"
                  f"<font size=8 color='#64748b'>{company} &nbsp;|&nbsp; "
                  f"{summary['year']}-{summary['month']:02d}</font>", sub_s),
        Paragraph(f"Employee: <b>{emp_name}</b> ({summary['emp_code']})<br/>"
                  f"Generated: {datetime.now().strftime('%d %b %Y %H:%M')}",
                  right_s),
    ]]
    hdr_tbl = Table(header_data, colWidths=[70*mm, 100*mm, 97*mm])
    hdr_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LINEBELOW", (0,0), (-1,-1), 1.5, BRAND),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    elems.append(hdr_tbl)
    elems.append(Spacer(1, 5*mm))

    # Summary cards
    p, a, w = summary["present"], summary["absent"], summary["weekly_off"]
    total = summary["total_days"]
    stats = [
        ["Present", "Absent", "Week Off", "Total Days", "Work Hours", "Avg/Day"],
        [str(p), str(a), str(w), str(total),
         summary["total_duration"], summary["avg_hrs_per_day"]],
    ]
    stats_tbl = Table(stats, colWidths=[44*mm]*6)
    stats_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), BRAND),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,1), (-1,1), "Helvetica-Bold"),
        ("FONTSIZE", (0,1), (-1,1), 16),
        ("TEXTCOLOR", (0,1), (0,1), GREEN),
        ("TEXTCOLOR", (1,1), (1,1), RED),
        ("TEXTCOLOR", (2,1), (2,1), AMBER),
        ("TEXTCOLOR", (3,1), (3,1), BRAND),
        ("TEXTCOLOR", (4,1), (4,1), BRAND),
        ("TEXTCOLOR", (5,1), (5,1), GRAY_TXT),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROWHEIGHT", (0,0), (-1,0), 16),
        ("ROWHEIGHT", (0,1), (-1,1), 24),
        ("GRID", (0,0), (-1,-1), 0.5, MID),
        ("ROUNDEDCORNERS", [6,6,6,6]),
    ]))
    elems.append(stats_tbl)
    elems.append(Spacer(1, 5*mm))

    # Daily log table
    col_w = [20*mm, 16*mm, 14*mm, 22*mm, 22*mm, 20*mm, 14*mm, 16*mm]
    hdr_row = ["Date", "Day", "Status", "First In", "Last Out",
               "Duration", "Punches", "Remarks"]
    rows = [hdr_row]
    for d in summary["daily"]:
        status = d["status"]
        rows.append([
            d["date"][5:],   # MM-DD
            d["day"],
            status,
            d["first_in"] or "—",
            d["last_out"] or "—",
            d["duration"],
            str(d["punch_count"]) if d["punch_count"] else "—",
            "Week Off" if status == "WO" else ("Absent" if status == "A" else ""),
        ])

    log_tbl = Table(rows, colWidths=col_w, repeatRows=1)
    style = TableStyle([
        ("BACKGROUND", (0,0), (-1,0), ACCENT),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ROWHEIGHT", (0,0), (-1,-1), 14),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, GRAY_BG]),
    ])
    for i, d in enumerate(summary["daily"], start=1):
        if d["status"] == "A":
            style.add("TEXTCOLOR", (2,i), (2,i), RED)
            style.add("FONTNAME", (2,i), (2,i), "Helvetica-Bold")
        elif d["status"] == "WO":
            style.add("TEXTCOLOR", (2,i), (2,i), AMBER)
        elif d["status"] == "P":
            style.add("TEXTCOLOR", (2,i), (2,i), GREEN)
    log_tbl.setStyle(style)
    elems.append(log_tbl)

    # Footer
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(GRAY_TXT)
        canvas.drawString(12*mm, 6*mm, "EastCoast HRMS — East Coast Hospitals Ltd, Pondicherry")
        canvas.drawRightString(landscape(A4)[0]-12*mm, 6*mm,
                               f"Page {doc.page}  |  Confidential")
        canvas.restoreState()

    doc.build(elems, onFirstPage=footer, onLaterPages=footer)
    buf.seek(0)
    return buf.read()
