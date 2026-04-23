from __future__ import annotations

from io import BytesIO
from statistics import mean
from typing import Any

import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _avg(values: list[float]) -> float:
    return mean(values) if values else 0.0


def _as_list(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(entry) for entry in raw]
    return []


def _build_joint_chart(biomechanics: list[dict[str, Any]]) -> BytesIO:
    metrics = {"Technique": [], "Symmetry": [], "Explosive": [], "Endurance": [], "Balance": []}
    for entry in biomechanics:
        if not entry:
            continue
        metrics["Technique"].append(float(entry.get("techniqueScore", 0)))
        metrics["Symmetry"].append(float(entry.get("symmetryScore", 0)))
        metrics["Explosive"].append(float(entry.get("explosiveness", 0)))
        metrics["Endurance"].append(float(entry.get("enduranceIndex", 0)))
        metrics["Balance"].append(float(entry.get("balanceScore", 0)))

    labels = list(metrics.keys())
    values = [_avg(metrics[key]) for key in labels]
    palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]

    fig, ax = plt.subplots(figsize=(9, 3.6))
    bars = ax.bar(labels, values, color=palette)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Score")
    ax.set_title("Biomechanics Composite Metrics")
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    for bar, value in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 1, f"{value:.1f}", ha="center")

    image_buffer = BytesIO()
    plt.tight_layout()
    fig.savefig(image_buffer, format="png", dpi=180)
    plt.close(fig)
    image_buffer.seek(0)
    return image_buffer


def generate_selection_pdf(
    report: dict[str, Any],
    athlete_profile: dict[str, Any],
    gemini_analysis: list[dict[str, Any]],
    biomechanics: list[dict[str, Any]],
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title",
        parent=styles["Heading1"],
        fontSize=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#334155"),
        leading=16,
    )

    story: list[Any] = []

    story.append(Paragraph("AthleteIQ Selection Report", title_style))
    story.append(Paragraph(f"<b>{athlete_profile.get('name', 'Athlete')}</b>", styles["Heading2"]))
    story.append(
        Paragraph(
            f"Sport: {athlete_profile.get('sport', '-')}&nbsp;&nbsp; | &nbsp;&nbsp;Region: {athlete_profile.get('region', '-')}",
            subtitle_style,
        )
    )
    story.append(Spacer(1, 0.22 * inch))

    score = float(report.get("compositeScore", 0))
    decision = str(report.get("selectionDecision", "PENDING"))
    decision_bg = {"SELECTED": "#16a34a", "WAITLISTED": "#d97706", "REJECTED": "#dc2626"}.get(decision, "#64748b")
    summary_table = Table([["Composite Score", f"{score:.1f}", f"Decision: {decision}"]], colWidths=[2.1 * inch, 1.9 * inch, 2.8 * inch], rowHeights=[1.0 * inch])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (1, 0), colors.HexColor("#0f172a")),
                ("BACKGROUND", (2, 0), (2, 0), colors.HexColor(decision_bg)),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("FONTSIZE", (0, 0), (0, 0), 15),
                ("FONTSIZE", (1, 0), (1, 0), 34),
                ("FONTSIZE", (2, 0), (2, 0), 16),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(summary_table)
    story.append(PageBreak())

    story.append(Paragraph("Biomechanics Breakdown", styles["Heading2"]))
    story.append(Image(_build_joint_chart(biomechanics), width=6.7 * inch, height=2.8 * inch))
    story.append(Spacer(1, 0.16 * inch))
    metrics = {
        "Technique Score": _avg([float(item.get("techniqueScore", 0)) for item in biomechanics if item]),
        "Symmetry Score": _avg([float(item.get("symmetryScore", 0)) for item in biomechanics if item]),
        "Explosiveness Score": _avg([float(item.get("explosiveness", 0)) for item in biomechanics if item]),
        "Endurance Index": _avg([float(item.get("enduranceIndex", 0)) for item in biomechanics if item]),
        "Balance Score": _avg([float(item.get("balanceScore", 0)) for item in biomechanics if item]),
    }
    rows = [["Metric", "Average Score"]] + [[name, f"{value:.1f}"] for name, value in metrics.items()]
    table = Table(rows, colWidths=[4.9 * inch, 1.8 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                ("GRID", (0, 0), (-1, -1), 0.7, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 1), (1, -1), "RIGHT"),
            ]
        )
    )
    story.append(table)
    story.append(PageBreak())

    story.append(Paragraph("Gemini AI Insights", styles["Heading2"]))
    latest = gemini_analysis[0] if gemini_analysis else {}
    strengths = _as_list(latest.get("strengths"))
    weaknesses = _as_list(latest.get("weaknesses"))
    risk_areas = _as_list(latest.get("injuryRiskAreas"))
    recommendations = _as_list(latest.get("trainingRecommendations"))

    story.append(Paragraph("<b>Strengths</b>", styles["Heading3"]))
    for item in strengths or ["No strengths generated"]:
        story.append(Paragraph(f"- {item}", subtitle_style))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph("<b>Weaknesses</b>", styles["Heading3"]))
    for item in weaknesses or ["No weaknesses generated"]:
        story.append(Paragraph(f"- {item}", subtitle_style))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph("<b>Injury Risk Areas</b>", styles["Heading3"]))
    for item in risk_areas or ["No specific risk area identified"]:
        story.append(Paragraph(f"- {item}", subtitle_style))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph("<b>Training Recommendations</b>", styles["Heading3"]))
    for item in recommendations or ["No recommendation generated"]:
        story.append(Paragraph(f"- {item}", subtitle_style))
    story.append(PageBreak())

    story.append(Paragraph("Video Timeline and Rationale", styles["Heading2"]))
    videos = report.get("videos", [])
    timeline_rows = [["Video", "Type", "Processed", "Score"]]
    for entry in videos:
        timeline_rows.append(
            [
                str(entry.get("id", ""))[:8],
                str(entry.get("type", "")),
                str(entry.get("processedAt", ""))[:10],
                f"{float(entry.get('compositeScore', 0)):.1f}" if entry.get("compositeScore") is not None else "-",
            ]
        )
    timeline = Table(timeline_rows, colWidths=[1.7 * inch, 1.4 * inch, 1.8 * inch, 1.2 * inch])
    timeline.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (3, 1), (3, -1), "RIGHT"),
            ]
        )
    )
    story.append(timeline)
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(f"<b>Selection Rationale:</b> {report.get('decisionReason') or 'Composite score and AI assessment across all analyzed videos.'}", subtitle_style))
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph(f"<b>AI Summary:</b> {latest.get('aiSummary', '-')}", subtitle_style))
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph(f"<b>Coach Notes:</b> {latest.get('coachNotes', '-')}", subtitle_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
