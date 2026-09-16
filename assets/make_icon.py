"""Generate the app icon (assets/icon.ico + png) with Qt only - no extra dependencies."""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from PySide6.QtCore import QRectF, Qt, QPointF  # noqa: E402
from PySide6.QtGui import QColor, QFont, QImage, QLinearGradient, QPainter, QPainterPath, QPen, QBrush  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402


def draw(size: int) -> QImage:
    img = QImage(size, size, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    s = size
    # rounded background
    grad = QLinearGradient(0, 0, s, s)
    grad.setColorAt(0, QColor("#2f6fed"))
    grad.setColorAt(1, QColor("#1b3f8f"))
    path = QPainterPath()
    path.addRoundedRect(QRectF(0, 0, s, s), s * 0.22, s * 0.22)
    p.fillPath(path, QBrush(grad))
    # car body
    p.setPen(Qt.NoPen)
    p.setBrush(QColor("#ffffff"))
    body = QPainterPath()
    body.moveTo(s * 0.16, s * 0.62)
    body.lineTo(s * 0.24, s * 0.44)
    body.lineTo(s * 0.38, s * 0.36)
    body.lineTo(s * 0.64, s * 0.36)
    body.lineTo(s * 0.78, s * 0.46)
    body.lineTo(s * 0.86, s * 0.62)
    body.lineTo(s * 0.86, s * 0.70)
    body.lineTo(s * 0.16, s * 0.70)
    body.closeSubpath()
    p.drawPath(body)
    # windows
    p.setBrush(QColor("#1b3f8f"))
    p.drawRoundedRect(QRectF(s * 0.30, s * 0.40, s * 0.15, s * 0.10), s * 0.02, s * 0.02)
    p.drawRoundedRect(QRectF(s * 0.50, s * 0.40, s * 0.20, s * 0.10), s * 0.02, s * 0.02)
    # wheels
    p.setBrush(QColor("#14161a"))
    p.drawEllipse(QPointF(s * 0.32, s * 0.71), s * 0.08, s * 0.08)
    p.drawEllipse(QPointF(s * 0.70, s * 0.71), s * 0.08, s * 0.08)
    p.setBrush(QColor("#9fc0ff"))
    p.drawEllipse(QPointF(s * 0.32, s * 0.71), s * 0.035, s * 0.035)
    p.drawEllipse(QPointF(s * 0.70, s * 0.71), s * 0.035, s * 0.035)
    # small "app grid" badge
    p.setBrush(QColor("#4cd964"))
    b = s * 0.10
    for i in range(2):
        for j in range(2):
            p.drawRoundedRect(QRectF(s * 0.62 + i * b * 1.15, s * 0.12 + j * b * 1.15, b, b), b * 0.25, b * 0.25)
    p.end()
    return img


def main() -> None:
    QApplication.instance() or QApplication(sys.argv)
    out = Path(__file__).resolve().parent
    big = draw(256)
    big.save(str(out / "icon.png"))
    # ICO: Qt writes a single-size ico; 256px is what Windows uses for large icons
    ok = big.save(str(out / "icon.ico"), "ICO")
    if not ok:
        raise SystemExit("could not write icon.ico")
    res = out.parent / "src" / "car_app_manager" / "resources"
    res.mkdir(parents=True, exist_ok=True)
    big.save(str(res / "icon.ico"), "ICO")
    big.save(str(res / "icon.png"))
    print("icon written:", out / "icon.ico")


if __name__ == "__main__":
    main()
