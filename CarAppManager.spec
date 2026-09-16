# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec: single-file windowed exe with the app icon and bundled resources.
import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None
ROOT = os.path.abspath(os.getcwd())
SRC = os.path.join(ROOT, "src")

hidden = []
hidden += collect_submodules("androguard.core")
hidden += ["keyring.backends.Windows", "keyring.backends.null", "keyring.backends.fail", "win32ctypes.pywin32"]

datas = [(os.path.join(SRC, "car_app_manager", "resources"), os.path.join("car_app_manager", "resources"))]
datas += collect_data_files("androguard", includes=["**/*.json", "**/*.txt", "**/*.xml"])

a = Analysis(
    [os.path.join(SRC, "run_app.py")],
    pathex=[SRC],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "scipy", "pandas", "IPython", "PyQt5", "PyQt6",
              "PySide6.QtWebEngineCore", "PySide6.QtWebEngineWidgets", "PySide6.Qt3DCore", "PySide6.QtCharts",
              "PySide6.QtDataVisualization", "PySide6.QtMultimedia", "PySide6.QtQml", "PySide6.QtQuick"],
    noarchive=False,
    cipher=block_cipher,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="CarAppManager",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon=os.path.join(ROOT, "assets", "icon.ico") if sys.platform == "win32" else None,
)
