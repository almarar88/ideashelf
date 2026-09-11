package ai.pacto.app.platform.overlay

import ai.pacto.app.MainActivity
import ai.pacto.app.R
import ai.pacto.app.platform.deadline.PactoNotifications
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import kotlin.math.abs

/**
 * The floating capture bubble. It sits above WhatsApp, Telegram or any marketplace chat; a tap
 * opens Pacto straight into capture with the chat text the user shares, so a deal never has to
 * leave the conversation it was made in.
 */
class ChatOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var bubble: View? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        PactoNotifications.ensureChannels(this)
        startForeground(PactoNotifications.OVERLAY_NOTIFICATION_ID, buildNotification())
        if (canDrawOverlays(this)) addBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (bubble == null && canDrawOverlays(this)) addBubble()
        return START_STICKY
    }

    private fun buildNotification() =
        NotificationCompat.Builder(this, PactoNotifications.CHANNEL_OVERLAY)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notif_overlay_running))
            .setOngoing(true)
            .build()

    private fun addBubble() {
        val manager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val view = TextView(this).apply {
            text = getString(R.string.app_name)
            setTextColor(Color.WHITE)
            textSize = 13f
            gravity = Gravity.CENTER
            contentDescription = getString(R.string.overlay_bubble_desc)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#2A2E22"))
                setStroke(3, Color.parseColor("#F0632A"))
            }
        }

        val size = (64 * resources.displayMetrics.density).toInt()
        val params = WindowManager.LayoutParams(
            size,
            size,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 320
        }

        view.setOnTouchListener(DragListener(manager, params) { openCapture() })
        runCatching { manager.addView(view, params) }
        windowManager = manager
        bubble = view
    }

    private fun openCapture() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_OPEN_CAPTURE, true)
        }
        startActivity(intent)
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    override fun onDestroy() {
        bubble?.let { view -> runCatching { windowManager?.removeView(view) } }
        bubble = null
        super.onDestroy()
    }

    /** Drag to move, tap to capture. */
    private class DragListener(
        private val manager: WindowManager,
        private val params: WindowManager.LayoutParams,
        private val onTap: () -> Unit
    ) : View.OnTouchListener {

        private var initialX = 0
        private var initialY = 0
        private var touchX = 0f
        private var touchY = 0f
        private var moved = false

        override fun onTouch(view: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    return true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (abs(dx) > 12 || abs(dy) > 12) moved = true
                    params.x = initialX + dx
                    params.y = initialY + dy
                    runCatching { manager.updateViewLayout(view, params) }
                    return true
                }

                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        view.performClick()
                        onTap()
                    }
                    return true
                }
            }
            return false
        }
    }

    companion object {
        fun canDrawOverlays(context: Context): Boolean = Settings.canDrawOverlays(context)

        fun start(context: Context) {
            val intent = Intent(context, ChatOverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ChatOverlayService::class.java))
        }
    }
}
