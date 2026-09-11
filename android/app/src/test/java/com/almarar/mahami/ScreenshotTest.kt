package com.almarar.mahami

import android.app.Application
import android.os.Looper
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.testing.WorkManagerTestInitHelper
import com.almarar.mahami.data.TaskRepository
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.screens.CalendarScreen
import com.almarar.mahami.ui.screens.HomeScreen
import com.almarar.mahami.ui.screens.OnboardingScreen
import com.almarar.mahami.ui.screens.ReportsScreen
import com.almarar.mahami.ui.screens.TaskDetailScreen
import com.almarar.mahami.ui.screens.TasksScreen
import com.almarar.mahami.ui.theme.MahamiAppTheme
import com.almarar.mahami.ui.theme.MahamiTheme
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h900dp-xhdpi")
class ScreenshotTest {

    private lateinit var app: Application
    private lateinit var vm: MahamiViewModel

    @Before
    fun setUp() {
        app = ApplicationProvider.getApplicationContext()
        WorkManagerTestInitHelper.initializeTestWorkManager(app, Configuration.Builder().build())
        runBlocking { TaskRepository.get(app).seedIfEmpty() }
        vm = MahamiViewModel(app)
        shadowOf(Looper.getMainLooper()).idle()
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        MahamiAppTheme(darkTheme = false) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(MahamiTheme.colors.background)
                ) { content() }
            }
        }
    }

    private fun shot(name: String, content: @Composable () -> Unit) {
        captureRoboImage("build/screenshots/$name.png") { Frame(content) }
    }

    @Test
    fun onboarding() = shot("01-onboarding") { OnboardingScreen(onFinish = {}) }

    @Test
    fun home() = shot("02-home") {
        HomeScreen(vm = vm, onOpenTask = {}, onOpenSettings = {}, onOpenTasks = {})
    }

    @Test
    fun tasks() = shot("03-tasks") { TasksScreen(vm = vm, onOpenTask = {}) }

    @Test
    fun calendar() = shot("04-calendar") { CalendarScreen(vm = vm, onOpenTask = {}) }

    @Test
    fun reports() = shot("05-reports") { ReportsScreen(vm = vm) }

    @Test
    fun detail() {
        val id = vm.tasks.value.firstOrNull()?.id ?: 1L
        shot("06-detail") {
            TaskDetailScreen(vm = vm, taskId = id, onBack = {}, onEdit = {})
        }
    }
}
