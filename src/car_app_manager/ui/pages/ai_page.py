"""AI Assistant page: crash doctor, APK risk explainer, natural-language planner, chat help."""
from __future__ import annotations

import os
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QAbstractItemView, QComboBox, QFileDialog, QHBoxLayout, QHeaderView, QLabel, QLineEdit,
                               QPlainTextEdit, QSpinBox, QTableWidget, QTableWidgetItem, QTabWidget, QTextBrowser,
                               QVBoxLayout, QWidget)

from ...ai import features as F
from ...ai.client import AIError
from ...ai.planner import ALLOWED_NAMES, Plan, PlanExecutor, make_plan
from ...apk.inspector import inspect_apk
from ...i18n import tr, current_lang
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, confirm, muted, title_label
from .base import BasePage

LEVEL_COLORS = {"low": "#4cd964", "medium": "#ffb84d", "high": "#ff6b6b"}
CONF_COLORS = {"high": "#4cd964", "medium": "#ffb84d", "low": "#ff6b6b"}


def _esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")


class AIPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        self.usage = StatusLine()
        self.root.addWidget(self.usage)
        self.note = muted("")
        self.root.addWidget(self.note)
        self.tabs = QTabWidget()
        self.root.addWidget(self.tabs, 1)
        self._build_doctor(); self._build_risk(); self._build_assistant(); self._build_chat()
        self.ctx.apps_loaded.connect(self._set_packages)
        self.plan: Plan | None = None
        self.chat_history: list[dict] = []
        self._busy = False

    def retranslate(self) -> None:
        self.title.setText(tr("ai.title"))
        self.note.setText(tr("ai.untrusted_note"))
        self.tabs.setTabText(0, tr("ai.tab.doctor")); self.tabs.setTabText(1, tr("ai.tab.risk"))
        self.tabs.setTabText(2, tr("ai.tab.assistant")); self.tabs.setTabText(3, tr("ai.tab.chat"))
        self.lbl_pkg.setText(tr("doctor.package")); self.lbl_lines.setText(tr("doctor.lines")); self.btn_doctor.setText(tr("doctor.run"))
        self.btn_risk_pick.setText(tr("risk.pick")); self.lbl_purpose.setText(tr("risk.purpose")); self.btn_risk.setText(tr("risk.run"))
        self.lbl_assist_help.setText(tr("assistant.help") + "\n" + tr("assistant.allowed", tools=", ".join(ALLOWED_NAMES)))
        self.ed_paths.setPlaceholderText(tr("assistant.folder")); self.btn_paths.setText(tr("browse"))
        self.btn_plan.setText(tr("assistant.plan")); self.btn_execute.setText(tr("assistant.approve"))
        self.plan_table.setHorizontalHeaderLabels([tr("assistant.col.step"), tr("assistant.col.status"), tr("assistant.col.result")])
        self.chat_input.setPlaceholderText(tr("chat.placeholder")); self.btn_send.setText(tr("chat.send")); self.btn_chat_clear.setText(tr("chat.clear"))
        self.refresh_usage()

    def on_show(self) -> None:
        self.refresh_usage()

    def refresh_usage(self) -> None:
        try:
            inp, out, spent = self.ctx.ai.month_usage()
            self.usage.set(tr("ai.usage", spent=spent, cap=float(self.ctx.settings.ai_monthly_cap_usd), inp=inp, out=out),
                           "warn" if spent >= float(self.ctx.settings.ai_monthly_cap_usd) else "muted")
        except Exception:
            pass
        if not self.ctx.ai.configured:
            self.usage.set(tr("ai.no_key"), "warn")

    def _guard(self, status: StatusLine) -> bool:
        if self._busy:
            return False
        if not self.ctx.ai.configured:
            status.set(tr("ai.no_key"), "error")
            return False
        return True

    def _err(self, status: StatusLine):
        def fail(msg):
            self._busy = False
            status.set(msg, "error")
            self.refresh_usage()
        return fail

    @staticmethod
    def _call(fn, *args):
        """Run an AI function in the worker; translate AIError to the UI language."""
        try:
            return fn(*args)
        except AIError as e:
            raise RuntimeError(e.text(current_lang())) from e

    def _cost_line(self, resp) -> str:
        return tr("ai.cost", cost=resp.cost_usd, model=resp.model) if resp else ""

    # ------------------------------------------------------------ crash doctor
    def _build_doctor(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        row = QHBoxLayout()
        self.lbl_pkg = QLabel(); self.cmb_pkg = QComboBox(); self.cmb_pkg.setEditable(True); self.cmb_pkg.setMinimumWidth(260)
        self.lbl_lines = QLabel(); self.spin_lines = QSpinBox(); self.spin_lines.setRange(50, 2000); self.spin_lines.setValue(400)
        self.btn_doctor = button("", "primary", self._run_doctor)
        row.addWidget(self.lbl_pkg); row.addWidget(self.cmb_pkg, 1); row.addWidget(self.lbl_lines); row.addWidget(self.spin_lines); row.addWidget(self.btn_doctor)
        lay.addLayout(row)
        self.doctor_status = StatusLine(); lay.addWidget(self.doctor_status)
        self.doctor_out = QTextBrowser(); lay.addWidget(self.doctor_out, 1)
        self.tabs.addTab(w, "")

    def _set_packages(self, pkgs: list[str]) -> None:
        cur = self.cmb_pkg.currentText()
        self.cmb_pkg.clear(); self.cmb_pkg.addItems(pkgs)
        if cur:
            self.cmb_pkg.setEditText(cur)

    def _run_doctor(self) -> None:
        if not self._guard(self.doctor_status):
            return
        if not self.ctx.device_ready:
            self.doctor_status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn"); return
        pkg = self.cmb_pkg.currentText().strip()
        if not pkg:
            return
        lang, model, n = current_lang(), self.ctx.settings.ai_cheap_model, self.spin_lines.value()
        info = self.ctx.device_info
        desc = f"{info.model}, Android {info.android_version} (API {info.sdk}), {', '.join(info.abis)}" if info else ""
        self._busy = True
        self.doctor_status.set(tr("working")); self.doctor_out.clear()

        def work(progress):
            text, count = F.collect_logcat(self.ctx.runner, pkg, n)
            progress(count)
            if count == 0:
                return None
            return self._call(F.crash_doctor, self.ctx.ai, pkg, text, lang, model, desc)

        def prog(count):
            self.doctor_status.set(tr("doctor.collected", n=count))

        def done(d):
            self._busy = False
            self.refresh_usage()
            if d is None:
                self.doctor_status.set(tr("doctor.no_lines"), "warn"); return
            if d.response and d.response.refusal:
                self.doctor_status.set(tr("ai.refused", why=d.response.refusal), "error"); return
            html = [f"<h3>{tr('doctor.cause')}</h3><p>{_esc(d.likely_cause) or _esc(d.raw_text)}</p>"]
            if d.evidence:
                html.append(f"<h3>{tr('doctor.evidence')}</h3><pre>{_esc(d.evidence)}</pre>")
            if d.fix_steps:
                html.append(f"<h3>{tr('doctor.steps')}</h3><ol>" + "".join(f"<li>{_esc(s)}</li>" for s in d.fix_steps) + "</ol>")
            html.append(f"<p><b>{tr('doctor.confidence')}:</b> <span style='color:{CONF_COLORS.get(d.confidence, '#e6e6e6')}'>{d.confidence}</span></p>")
            self.doctor_out.setHtml("".join(html))
            self.doctor_status.set(self._cost_line(d.response), "ok")

        run_in_background(work, on_done=done, on_error=self._err(self.doctor_status), on_progress=prog)

    # ------------------------------------------------------------ risk explainer
    def _build_risk(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        row = QHBoxLayout()
        self.btn_risk_pick = button("", slot=self._pick_apk)
        self.ed_risk_path = QLineEdit(); self.ed_risk_path.setReadOnly(True)
        row.addWidget(self.btn_risk_pick); row.addWidget(self.ed_risk_path, 1)
        lay.addLayout(row)
        row2 = QHBoxLayout()
        self.lbl_purpose = QLabel(); self.ed_purpose = QLineEdit(); self.btn_risk = button("", "primary", self._run_risk)
        row2.addWidget(self.lbl_purpose); row2.addWidget(self.ed_purpose, 1); row2.addWidget(self.btn_risk)
        lay.addLayout(row2)
        self.risk_status = StatusLine(); lay.addWidget(self.risk_status)
        self.risk_out = QTextBrowser(); lay.addWidget(self.risk_out, 1)
        self.tabs.addTab(w, "")

    def _pick_apk(self) -> None:
        p, _ = QFileDialog.getOpenFileName(self, tr("risk.pick"), "", "APK (*.apk *.apks *.xapk *.apkm);;All (*)")
        if p:
            self.ed_risk_path.setText(p)

    def _run_risk(self) -> None:
        if not self._guard(self.risk_status):
            return
        path = self.ed_risk_path.text().strip()
        if not path or not os.path.isfile(path):
            return
        lang, model, purpose = current_lang(), self.ctx.settings.ai_cheap_model, self.ed_purpose.text().strip()
        self._busy = True
        self.risk_status.set(tr("risk.inspecting")); self.risk_out.clear()

        def work():
            info = inspect_apk(path)
            if info.parse_error and not info.package:
                raise RuntimeError(info.parse_error)
            return self._call(F.risk_explainer, self.ctx.ai, info, lang, model, purpose)

        def done(rep):
            self._busy = False
            self.refresh_usage()
            if rep.response and rep.response.refusal:
                self.risk_status.set(tr("ai.refused", why=rep.response.refusal), "error"); return
            html = [f"<p><b>{tr('risk.level')}:</b> <span style='color:{LEVEL_COLORS.get(rep.risk_level, '#e6e6e6')}'>{rep.risk_level}</span></p>",
                    f"<h3>{tr('risk.summary')}</h3><p>{_esc(rep.summary) or _esc(rep.raw_text)}</p>"]
            if rep.notable_permissions:
                html.append(f"<h3>{tr('risk.perms')}</h3><ul>" + "".join(
                    f"<li><b>{_esc(p.get('permission', ''))}</b>: {_esc(p.get('why_it_matters', ''))}</li>" for p in rep.notable_permissions) + "</ul>")
            if rep.compatibility_notes:
                html.append(f"<h3>{tr('risk.compat')}</h3><ul>" + "".join(f"<li>{_esc(s)}</li>" for s in rep.compatibility_notes) + "</ul>")
            if rep.recommendation:
                html.append(f"<h3>{tr('risk.recommendation')}</h3><p>{_esc(rep.recommendation)}</p>")
            self.risk_out.setHtml("".join(html))
            self.risk_status.set(self._cost_line(rep.response), "ok")

        run_in_background(work, on_done=done, on_error=self._err(self.risk_status))

    # ------------------------------------------------------------ assistant (planner)
    def _build_assistant(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        self.lbl_assist_help = muted(""); lay.addWidget(self.lbl_assist_help)
        self.ed_request = QPlainTextEdit(); self.ed_request.setMaximumHeight(80); lay.addWidget(self.ed_request)
        row = QHBoxLayout()
        self.ed_paths = QLineEdit(); self.btn_paths = button("", slot=self._pick_folder)
        self.btn_plan = button("", "primary", self._make_plan); self.btn_execute = button("", "danger", self._execute); self.btn_execute.setEnabled(False)
        row.addWidget(self.ed_paths, 1); row.addWidget(self.btn_paths); row.addWidget(self.btn_plan); row.addWidget(self.btn_execute)
        lay.addLayout(row)
        self.plan_explanation = muted(""); lay.addWidget(self.plan_explanation)
        self.plan_table = QTableWidget(0, 3)
        self.plan_table.setSelectionBehavior(QAbstractItemView.SelectRows); self.plan_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.plan_table.verticalHeader().setVisible(False)
        self.plan_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.plan_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        lay.addWidget(self.plan_table, 1)
        self.assist_status = StatusLine(); lay.addWidget(self.assist_status)
        self.tabs.addTab(w, "")

    def _pick_folder(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("assistant.folder"))
        if d:
            self.ed_paths.setText(d)

    def _make_plan(self) -> None:
        if not self._guard(self.assist_status):
            return
        req = self.ed_request.toPlainText().strip()
        if not req:
            return
        lang, model = current_lang(), self.ctx.settings.ai_smart_model
        paths = [p.strip() for p in self.ed_paths.text().split(";") if p.strip()]
        self._busy = True
        self.plan = None; self.btn_execute.setEnabled(False)
        self.assist_status.set(tr("working"))
        self.ctx.logger.note("assistant request", req[:500])

        def done(plan: Plan):
            self._busy = False
            self.refresh_usage()
            self.plan = plan
            self.plan_explanation.setText(plan.explanation)
            self._fill_plan()
            if plan.refusal:
                self.assist_status.set(tr("ai.refused", why=plan.refusal), "error")
            elif not plan.executable:
                self.assist_status.set(tr("assistant.no_steps"), "warn")
            else:
                self.assist_status.set(tr("assistant.status.pending"), "ok")
                self.btn_execute.setEnabled(True)

        run_in_background(self._call, make_plan, self.ctx.ai, req, lang, model, paths, on_done=done, on_error=self._err(self.assist_status))

    def _fill_plan(self) -> None:
        self.plan_table.setRowCount(0)
        if not self.plan:
            return
        lang = current_lang()
        for s in self.plan.steps:
            r = self.plan_table.rowCount(); self.plan_table.insertRow(r)
            status = tr("assistant.rejected", reason=s.reason) if not s.allowed else tr(f"assistant.status.{s.status}")
            vals = (s.describe(lang), status, (s.result or "")[:300].replace("\n", " | "))
            for c, v in enumerate(vals):
                it = QTableWidgetItem(v)
                if c == 1:
                    color = "#ff6b6b" if (not s.allowed or s.status == "failed") else "#4cd964" if s.status == "done" else "#ffb84d"
                    it.setForeground(QColor(color))
                self.plan_table.setItem(r, c, it)

    def _execute(self) -> None:
        if self._busy or not self.plan or not self.plan.executable:
            return
        if not self.ctx.device_ready:
            self.assist_status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn"); return
        n = len(self.plan.executable)
        if not confirm(self, tr("assistant.confirm", n=n) + "\n\n" + "\n".join("• " + s.describe(current_lang()) for s in self.plan.executable), danger=True):
            return
        self.ctx.logger.note("assistant plan approved", ", ".join(s.tool for s in self.plan.executable), device=self.ctx.runner.serial or "")
        self._busy = True; self.btn_execute.setEnabled(False)
        executor = PlanExecutor(self.ctx)

        def prog(ev):
            self._fill_plan()

        def done(plan):
            self._busy = False
            self._fill_plan()
            ok = sum(1 for s in plan.steps if s.status == "done"); fail = sum(1 for s in plan.steps if s.status == "failed")
            self.assist_status.set(tr("assistant.done", ok=ok, fail=fail), "ok" if not fail else "warn")

        run_in_background(executor.run, self.plan, on_done=done, on_error=self._err(self.assist_status), on_progress=prog)

    # ------------------------------------------------------------ chat
    def _build_chat(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        self.chat_view = QTextBrowser(); lay.addWidget(self.chat_view, 1)
        row = QHBoxLayout()
        self.chat_input = QLineEdit(); self.chat_input.returnPressed.connect(self._send_chat)
        self.btn_send = button("", "primary", self._send_chat); self.btn_chat_clear = button("", slot=self._clear_chat)
        row.addWidget(self.chat_input, 1); row.addWidget(self.btn_send); row.addWidget(self.btn_chat_clear)
        lay.addLayout(row)
        self.chat_status = StatusLine(); lay.addWidget(self.chat_status)
        self.tabs.addTab(w, "")

    def _clear_chat(self) -> None:
        self.chat_history = []; self.chat_view.clear(); self.chat_status.set("")

    def _render_chat(self) -> None:
        html = []
        for m in self.chat_history:
            who = "👤" if m["role"] == "user" else "✨"
            bg = "#1c1f25" if m["role"] == "user" else "#16203a"
            html.append(f"<div style='background:{bg};padding:8px;margin:4px;border-radius:6px'>{who} {_esc(m['content'])}</div>")
        self.chat_view.setHtml("".join(html))
        self.chat_view.verticalScrollBar().setValue(self.chat_view.verticalScrollBar().maximum())

    def _send_chat(self) -> None:
        if not self._guard(self.chat_status):
            return
        text = self.chat_input.text().strip()
        if not text:
            return
        self.chat_input.clear()
        self.chat_history.append({"role": "user", "content": text})
        self._render_chat()
        lang, model = current_lang(), self.ctx.settings.ai_cheap_model
        history = [dict(m) for m in self.chat_history[-20:]]
        self._busy = True; self.chat_status.set(tr("working"))

        def done(resp):
            self._busy = False
            self.refresh_usage()
            if resp.refusal:
                self.chat_status.set(tr("ai.refused", why=resp.refusal), "error")
                self.chat_history.pop(); self._render_chat(); return
            self.chat_history.append({"role": "assistant", "content": resp.text.strip()})
            self._render_chat()
            self.chat_status.set(self._cost_line(resp), "ok")

        def fail(msg):
            self._busy = False
            self.chat_history.pop(); self._render_chat()
            self.chat_status.set(msg, "error")

        run_in_background(self._call, F.chat, self.ctx.ai, history, lang, model, on_done=done, on_error=fail)
