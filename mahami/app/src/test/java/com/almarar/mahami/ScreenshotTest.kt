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
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.ThemeMode
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.LocalAnimationsEnabled
import com.almarar.mahami.ui.screens.AboutScreen
import com.almarar.mahami.ui.screens.AccountScreen
import com.almarar.mahami.ui.screens.ImportScreen
import com.almarar.mahami.ui.screens.MatrixScreen
import com.almarar.mahami.ui.screens.CalendarScreen
import com.almarar.mahami.ui.screens.HomeScreen
import com.almarar.mahami.ui.screens.OnboardingScreen
import com.almarar.mahami.ui.screens.ArchiveScreen
import com.almarar.mahami.ui.screens.PaywallScreen
import com.almarar.mahami.ui.screens.ProjectsScreen
import com.almarar.mahami.ui.screens.ReportsScreen
import com.almarar.mahami.ui.screens.SettingsScreen
import com.almarar.mahami.ui.screens.TaskDetailScreen
import com.almarar.mahami.ui.screens.TaskEditScreen
import com.almarar.mahami.ui.screens.TasksScreen
import com.almarar.mahami.ui.screens.TemplatesScreen
import com.almarar.mahami.ui.theme.MahamiAppTheme
import com.almarar.mahami.ui.theme.MahamiTheme
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.coroutines.runBlocking
import org.junit.Before
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
        runBlocking {
            val repo = Repository.get(app)
            repo.initializeIfNeeded()
            if (repo.allTasks().isEmpty()) repo.loadDemoData()
        }
        vm = MahamiViewModel(app)
        vm.setUserName("أبو راشد")
        idle()
    }

    private fun idle() = shadowOf(Looper.getMainLooper()).idle()

    @Composable
    private fun Frame(dark: Boolean = false, content: @Composable () -> Unit) {
        MahamiAppTheme(themeMode = if (dark) ThemeMode.DARK else ThemeMode.LIGHT) {
            CompositionLocalProvider(
                LocalLayoutDirection provides LayoutDirection.Rtl,
                // الحركة اللانهائية تمنع استقرار الشاشة فيتجمّد الالتقاط
                LocalAnimationsEnabled provides false
            ) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(MahamiTheme.colors.background)
                ) { content() }
            }
        }
    }

    private fun shot(name: String, dark: Boolean = false, content: @Composable () -> Unit) {
        captureRoboImage("build/screenshots/$name.png") { Frame(dark) { content() } }
    }

    @Test fun onboarding() = shot("01-onboarding") { OnboardingScreen {} }

    @Test fun home() = shot("02-home") {
        HomeScreen(
            vm = vm,
            onOpenTask = {}, onOpenSettings = {}, onOpenTasks = {},
            onOpenTemplates = {}, onNewTask = {}
        )
    }

    @Test fun tasks() = shot("03-tasks") {
        TasksScreen(vm = vm, onOpenTask = {}, onNewTask = {}, onOpenProjects = {})
    }

    @Test fun calendar() = shot("04-calendar") { CalendarScreen(vm) {} }

    @Test fun reports() = shot("05-reports") { ReportsScreen(vm) }

    @Test fun detail() {
        val id = vm.tasks.value.firstOrNull()?.id ?: 1L
        shot("06-detail") { TaskDetailScreen(vm, id, onBack = {}, onEdit = {}) }
    }

    @Test fun templates() = shot("07-templates") {
        TemplatesScreen(vm, onCreated = {}, onBack = {})
    }

    @Test fun projects() = shot("08-projects") { ProjectsScreen(vm) {} }

    @Test fun settings() {
        org.robolectric.RuntimeEnvironment.setQualifiers("+h2200dp")
        shot("09-settings") {
            SettingsScreen(vm, onBack = {}, onOpenProjects = {}, onOpenAbout = {})
        }
    }

    @Test fun editor() {
        org.robolectric.RuntimeEnvironment.setQualifiers("+h1800dp")
        shot("10-editor") { TaskEditScreen(vm, taskId = null, onDone = {}) }
    }

    @Test fun about() = shot("11-about") { AboutScreen {} }

    @Test fun paywall() {
        org.robolectric.RuntimeEnvironment.setQualifiers("+h1700dp")
        shot("13-paywall") { PaywallScreen(vm) {} }
    }

    @Test fun archive() = shot("14-archive") { ArchiveScreen(vm, onOpenTask = {}, onBack = {}) }

    @Test fun account() = shot("15-account") { AccountScreen(vm) {} }

    @Test fun matrix() = shot("16-matrix") {
        MatrixScreen(vm, onOpenTask = {}, onBack = {})
    }

    @Test fun import_() {
        vm.prepareImport(
            """
            - تجهيز عرض اللجنة الأربعاء الساعة 10 عاجل #عروض
            - مراجعة ملفات المدربين بعد 3 أيام
            - اتصال بمنصة التسجيل غداً
            """.trimIndent()
        )
        idle()
        shot("17-import") { ImportScreen(vm, onBack = {}, onDone = {}) }
    }

    @Test fun homeDark() = shot("12-home-dark", dark = true) {
        HomeScreen(
            vm = vm,
            onOpenTask = {}, onOpenSettings = {}, onOpenTasks = {},
            onOpenTemplates = {}, onNewTask = {}
        )
    }
}
