from __future__ import annotations

from PySide6.QtWidgets import QLabel

from ...i18n import tr
from ..widgets.common import muted, title_label
from .base import BasePage


class PlaceholderPage(BasePage):
    def __init__(self, ctx, title_key: str, parent=None):
        self.title_key = title_key
        super().__init__(ctx, parent)

    def build(self) -> None:
        self.title = title_label("")
        self.text = muted("")
        self.root.addWidget(self.title)
        self.root.addWidget(self.text)
        self.root.addStretch(1)

    def retranslate(self) -> None:
        self.title.setText(tr(self.title_key))
        self.text.setText(tr("coming"))
