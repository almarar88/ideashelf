package com.almarar.mahami.ui

/** حالة مؤقت التركيز */
data class FocusState(
    val taskId: Long = 0,
    val taskTitle: String = "",
    val totalSeconds: Int = 0,
    val remainingSeconds: Int = 0,
    val running: Boolean = false,
    val completedJustNow: Boolean = false
) {
    val active: Boolean get() = taskId > 0
    val progress: Float
        get() = if (totalSeconds == 0) 0f else 1f - remainingSeconds.toFloat() / totalSeconds

    val display: String
        get() {
            val minutes = remainingSeconds / 60
            val seconds = remainingSeconds % 60
            return "%02d:%02d".format(minutes, seconds)
        }
}
