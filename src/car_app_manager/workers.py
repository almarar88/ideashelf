"""Background execution helpers so the UI never blocks on adb."""
from __future__ import annotations

import logging
import traceback
from typing import Any, Callable, Optional

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal, Slot

log = logging.getLogger(__name__)

# Keep Python references to running workers; otherwise PySide may collect the wrapper (and its signals)
# while the C++ runnable is still queued.
_active: set["Worker"] = set()


class WorkerSignals(QObject):
    finished = Signal(object)
    error = Signal(str)
    progress = Signal(object)


class Worker(QRunnable):
    """Runs fn(*args, **kwargs). If fn accepts a `progress` kwarg it receives a callable."""

    def __init__(self, fn: Callable[..., Any], *args, pass_progress: bool = False, **kwargs):
        super().__init__()
        self.fn, self.args, self.kwargs = fn, args, kwargs
        self.signals = WorkerSignals()
        self.pass_progress = pass_progress
        self.setAutoDelete(False)

    @Slot()
    def run(self) -> None:
        try:
            if self.pass_progress:
                emit = self.signals.progress.emit
                # accept progress(a), progress(a, b, c) ... -> single object / tuple on the Qt side
                self.kwargs["progress"] = lambda *a: emit(a[0] if len(a) == 1 else a)
            result = self.fn(*self.args, **self.kwargs)
        except Exception as e:  # noqa: BLE001
            log.error("worker failed: %s\n%s", e, traceback.format_exc())
            self.signals.error.emit(str(e))
            return
        finally:
            _active.discard(self)
        self.signals.finished.emit(result)


def run_in_background(
    fn: Callable[..., Any],
    *args,
    on_done: Optional[Callable[[Any], None]] = None,
    on_error: Optional[Callable[[str], None]] = None,
    on_progress: Optional[Callable[[Any], None]] = None,
    **kwargs,
) -> Worker:
    w = Worker(fn, *args, pass_progress=on_progress is not None, **kwargs)
    if on_done:
        w.signals.finished.connect(on_done)
    if on_error:
        w.signals.error.connect(on_error)
    if on_progress:
        w.signals.progress.connect(on_progress)
    _active.add(w)
    QThreadPool.globalInstance().start(w)
    return w
