"""Small reusable widgets and dialogs."""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QDialog, QDialogButtonBox, QFrame, QHBoxLayout, QLabel, QLineEdit, QMessageBox,
                               QPushButton, QVBoxLayout, QWidget)

from ...i18n import tr


def title_label(text: str) -> QLabel:
    l = QLabel(text)
    l.setObjectName("title")
    return l


def muted(text: str = "") -> QLabel:
    l = QLabel(text)
    l.setObjectName("muted")
    l.setWordWrap(True)
    return l


def card() -> tuple[QFrame, QVBoxLayout]:
    f = QFrame()
    f.setObjectName("card")
    lay = QVBoxLayout(f)
    lay.setContentsMargins(14, 12, 14, 12)
    lay.setSpacing(8)
    return f, lay


def hrow(*widgets: QWidget, stretch_last: bool = False) -> QHBoxLayout:
    h = QHBoxLayout()
    h.setContentsMargins(0, 0, 0, 0)
    for w in widgets:
        h.addWidget(w)
    if stretch_last:
        h.addStretch(1)
    return h


def button(text: str, kind: str = "", slot=None) -> QPushButton:
    b = QPushButton(text)
    if kind:
        b.setObjectName(kind)
    if slot:
        b.clicked.connect(slot)
    return b


def confirm(parent: Optional[QWidget], text: str, title: str = "", danger: bool = False) -> bool:
    box = QMessageBox(parent)
    box.setIcon(QMessageBox.Warning if danger else QMessageBox.Question)
    box.setWindowTitle(title or tr("confirm"))
    box.setText(text)
    yes = box.addButton(tr("yes"), QMessageBox.YesRole)
    box.addButton(tr("cancel"), QMessageBox.RejectRole)
    box.setDefaultButton(yes if not danger else box.buttons()[1])
    box.exec()
    return box.clickedButton() is yes


def info(parent: Optional[QWidget], text: str, title: str = "") -> None:
    QMessageBox.information(parent, title or tr("app.title"), text)


def error(parent: Optional[QWidget], text: str, title: str = "") -> None:
    QMessageBox.critical(parent, title or tr("error"), text)


class TypeToConfirmDialog(QDialog):
    """Second step of a two-step confirmation: the user must type a keyword."""

    def __init__(self, parent: Optional[QWidget], text: str, keyword: str, title: str = ""):
        super().__init__(parent)
        self.setWindowTitle(title or tr("confirm"))
        self.keyword = keyword
        lay = QVBoxLayout(self)
        lbl = QLabel(text)
        lbl.setWordWrap(True)
        lay.addWidget(lbl)
        self.edit = QLineEdit()
        self.edit.setPlaceholderText(keyword)
        lay.addWidget(self.edit)
        self.buttons = QDialogButtonBox()
        self.ok_btn = self.buttons.addButton(tr("confirm"), QDialogButtonBox.AcceptRole)
        self.ok_btn.setObjectName("danger")
        self.ok_btn.setEnabled(False)
        self.buttons.addButton(tr("cancel"), QDialogButtonBox.RejectRole)
        self.buttons.accepted.connect(self.accept)
        self.buttons.rejected.connect(self.reject)
        lay.addWidget(self.buttons)
        self.edit.textChanged.connect(lambda t: self.ok_btn.setEnabled(t.strip() == self.keyword))
        self.setMinimumWidth(420)

    @staticmethod
    def ask(parent: Optional[QWidget], text: str, keyword: str, title: str = "") -> bool:
        d = TypeToConfirmDialog(parent, text, keyword, title)
        return d.exec() == QDialog.Accepted and d.edit.text().strip() == keyword


class StatusLine(QLabel):
    """One-line status message with level colouring."""

    def __init__(self):
        super().__init__("")
        self.setWordWrap(True)
        self.setTextInteractionFlags(Qt.TextSelectableByMouse)

    def set(self, text: str, level: str = "muted") -> None:
        self.setObjectName({"ok": "ok", "warn": "warn", "error": "danger"}.get(level, "muted"))
        self.setText(text)
        self.style().unpolish(self)
        self.style().polish(self)
