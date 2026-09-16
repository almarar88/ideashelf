"""Minimal dark theme."""

DARK_QSS = """
* { font-size: 13px; }
QWidget { background: #14161a; color: #e6e6e6; selection-background-color: #2f6fed; selection-color: #ffffff; }
QMainWindow, QDialog { background: #14161a; }
QLabel { background: transparent; }
QLabel#title { font-size: 20px; font-weight: 600; padding: 4px 0 8px 0; }
QLabel#muted { color: #9aa0a6; }
QLabel#danger { color: #ff6b6b; }
QLabel#ok { color: #4cd964; }
QLabel#warn { color: #ffb84d; }
QFrame#card { background: #1c1f25; border: 1px solid #2a2e36; border-radius: 8px; }
QFrame#sidebar { background: #0f1114; border-right: 1px solid #2a2e36; }
QListWidget#nav { background: #0f1114; border: none; outline: 0; font-size: 14px; }
QListWidget#nav::item { padding: 10px 14px; border-radius: 6px; margin: 2px 6px; }
QListWidget#nav::item:selected { background: #2f6fed; color: white; }
QListWidget#nav::item:hover:!selected { background: #1c1f25; }
QPushButton { background: #262a32; border: 1px solid #343944; border-radius: 6px; padding: 6px 14px; min-height: 22px; }
QPushButton:hover { background: #2f343e; }
QPushButton:pressed { background: #1f2329; }
QPushButton:disabled { color: #6b7075; background: #1c1f25; border-color: #262a32; }
QPushButton#primary { background: #2f6fed; border-color: #2f6fed; color: white; font-weight: 600; }
QPushButton#primary:hover { background: #3f7cf5; }
QPushButton#primary:disabled { background: #22395f; border-color: #22395f; color: #8fa3c8; }
QPushButton#danger { background: #7a2222; border-color: #8f2a2a; color: white; }
QPushButton#danger:hover { background: #932a2a; }
QPushButton#danger:disabled { background: #3a1e1e; border-color: #3a1e1e; color: #8a6a6a; }
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QTextEdit, QPlainTextEdit {
  background: #0f1114; border: 1px solid #343944; border-radius: 6px; padding: 5px 8px; }
QLineEdit:focus, QComboBox:focus, QTextEdit:focus, QPlainTextEdit:focus { border-color: #2f6fed; }
QComboBox::drop-down { border: none; width: 22px; }
QComboBox QAbstractItemView { background: #1c1f25; border: 1px solid #343944; selection-background-color: #2f6fed; }
QTableView, QTableWidget, QListWidget, QTreeWidget { background: #0f1114; border: 1px solid #2a2e36; border-radius: 6px;
  gridline-color: #22262d; alternate-background-color: #14171c; outline: 0; }
QTableView::item, QTableWidget::item { padding: 4px; }
QTableView::item:selected, QTableWidget::item:selected { background: #2f6fed; color: white; }
QHeaderView::section { background: #1c1f25; color: #b7bcc3; border: none; border-bottom: 1px solid #2a2e36; padding: 6px; font-weight: 600; }
QProgressBar { background: #0f1114; border: 1px solid #343944; border-radius: 6px; text-align: center; height: 16px; }
QProgressBar::chunk { background: #2f6fed; border-radius: 5px; }
QCheckBox::indicator, QRadioButton::indicator { width: 16px; height: 16px; }
QCheckBox::indicator { border: 1px solid #4a505b; border-radius: 3px; background: #0f1114; }
QCheckBox::indicator:checked { background: #2f6fed; border-color: #2f6fed; }
QGroupBox { border: 1px solid #2a2e36; border-radius: 8px; margin-top: 14px; padding: 12px 8px 8px 8px; font-weight: 600; }
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 6px; color: #b7bcc3; }
QScrollBar:vertical { background: #0f1114; width: 10px; margin: 0; }
QScrollBar::handle:vertical { background: #343944; border-radius: 5px; min-height: 24px; }
QScrollBar:horizontal { background: #0f1114; height: 10px; margin: 0; }
QScrollBar::handle:horizontal { background: #343944; border-radius: 5px; min-width: 24px; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; width: 0; }
QStatusBar { background: #0f1114; border-top: 1px solid #2a2e36; color: #b7bcc3; }
QToolTip { background: #1c1f25; color: #e6e6e6; border: 1px solid #343944; padding: 4px; }
QSplitter::handle { background: #2a2e36; }
QTabWidget::pane { border: 1px solid #2a2e36; border-radius: 6px; }
QTabBar::tab { background: #1c1f25; padding: 6px 12px; border: 1px solid #2a2e36; border-bottom: none; border-top-left-radius: 6px; border-top-right-radius: 6px; }
QTabBar::tab:selected { background: #262a32; }
QFrame#dropzone { border: 2px dashed #3a4050; border-radius: 10px; background: #111317; }
QFrame#dropzone[active="true"] { border-color: #2f6fed; background: #16203a; }
"""
