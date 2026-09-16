from __future__ import annotations

from PySide6.QtWidgets import QWidget, QVBoxLayout

from ...app import AppContext


class BasePage(QWidget):
    def __init__(self, ctx: AppContext, parent: QWidget | None = None):
        super().__init__(parent)
        self.ctx = ctx
        self.root = QVBoxLayout(self)
        self.root.setContentsMargins(20, 16, 20, 16)
        self.root.setSpacing(10)
        self.build()
        self.retranslate()
        ctx.language_changed.connect(lambda _l: self.retranslate())

    def build(self) -> None:  # pragma: no cover - overridden
        pass

    def retranslate(self) -> None:  # pragma: no cover - overridden
        pass

    def on_show(self) -> None:
        """Called when the page becomes visible."""
