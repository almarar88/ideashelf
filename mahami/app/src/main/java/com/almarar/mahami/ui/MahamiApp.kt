package com.almarar.mahami.ui

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Checklist
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.almarar.mahami.ui.components.BottomNavPill
import com.almarar.mahami.ui.components.NavItem
import com.almarar.mahami.ui.components.VoiceSheet
import com.almarar.mahami.voice.VoiceRecognizer
import com.almarar.mahami.ui.screens.AboutScreen
import com.almarar.mahami.ui.screens.AccountScreen
import com.almarar.mahami.ui.screens.ArchiveScreen
import com.almarar.mahami.ui.screens.CalendarScreen
import com.almarar.mahami.ui.screens.FocusScreen
import com.almarar.mahami.ui.screens.HomeScreen
import com.almarar.mahami.ui.screens.ImportScreen
import com.almarar.mahami.ui.screens.MatrixScreen
import com.almarar.mahami.ui.screens.OnboardingScreen
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

object Routes {
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val TASKS = "tasks"
    const val CALENDAR = "calendar"
    const val REPORTS = "reports"
    const val SETTINGS = "settings"
    const val PROJECTS = "projects"
    const val TEMPLATES = "templates"
    const val ABOUT = "about"
    const val PAYWALL = "paywall"
    const val ARCHIVE = "archive"
    const val ACCOUNT = "account"
    const val IMPORT = "import"
    const val MATRIX = "matrix"
    const val FOCUS = "focus/{taskId}"
    const val DETAIL = "detail/{taskId}"
    const val EDIT = "edit?taskId={taskId}"

    fun detail(id: Long) = "detail/$id"
    fun focus(id: Long) = "focus/$id"
    fun edit(id: Long? = null) = "edit?taskId=${id ?: -1}"
}

private val navItems = listOf(
    NavItem(Routes.HOME, Icons.Rounded.Home, "الرئيسية"),
    NavItem(Routes.TASKS, Icons.Rounded.Checklist, "المهام"),
    NavItem(Routes.CALENDAR, Icons.Rounded.CalendarMonth, "التقويم"),
    NavItem(Routes.REPORTS, Icons.Rounded.BarChart, "التقارير")
)

/** وجهة أولية قادمة من اختصارات الشاشة الرئيسية أو من إشعار */
sealed interface StartDestination {
    data object None : StartDestination
    data object NewTask : StartDestination
    data object Today : StartDestination
    data object Calendar : StartDestination
    data class TaskDetail(val id: Long) : StartDestination
    /** نص وصل من تطبيق آخر عبر «مشاركة» */
    data class SharedText(val text: String) : StartDestination
}

@Composable
fun MahamiApp(start: StartDestination = StartDestination.None) {
    val vm: MahamiViewModel = viewModel()
    val settings by vm.settings.collectAsStateWithLifecycle()

    MahamiAppTheme(themeMode = settings.themeMode, accent = settings.accentColor) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            val navController = rememberNavController()
            val backStack by navController.currentBackStackEntryAsState()
            val route = backStack?.destination?.route
            val colors = MahamiTheme.colors
            val snackbarHost = remember { SnackbarHostState() }
            val toast by vm.toast.collectAsStateWithLifecycle()

            val showNav = route in setOf(
                Routes.HOME, Routes.TASKS, Routes.CALENDAR, Routes.REPORTS
            )

            // المسار الاحتياطي: نافذة النظام حين لا يتوفّر الاستماع المباشر
            val voiceLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult()
            ) { result ->
                if (result.resultCode == Activity.RESULT_OK) {
                    result.data
                        ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                        ?.firstOrNull()
                        ?.takeIf { it.isNotBlank() }
                        ?.let { vm.addFromVoice(it) }
                }
            }
            val launchSystemDictation: () -> Unit = {
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(
                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                    )
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA")
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar")
                    putExtra(RecognizerIntent.EXTRA_PROMPT, "قل مهمتك…")
                }
                runCatching { voiceLauncher.launch(intent) }
                    .onFailure { vm.showToast(VoiceRecognizer.NO_ENGINE) }
            }

            val micPermission = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                if (granted) vm.startListening()
                else vm.showToast("بدون إذن الميكروفون لا يمكن الإملاء الصوتي")
            }

            val startVoice: () -> Unit = {
                when {
                    !vm.voiceAvailable() -> launchSystemDictation()
                    vm.voiceNeedsPermission() ->
                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    else -> vm.startListening()
                }
            }

            val lockedFeature by vm.lockedFeature.collectAsStateWithLifecycle()
            LaunchedEffect(lockedFeature) {
                if (lockedFeature != null && route != Routes.PAYWALL) {
                    navController.navigate(Routes.PAYWALL)
                }
            }

            LaunchedEffect(toast?.id) {
                val current = toast ?: return@LaunchedEffect
                val result = snackbarHost.showSnackbar(
                    message = current.message,
                    actionLabel = if (current.undo != null) "تراجع" else null,
                    duration = SnackbarDuration.Short
                )
                if (result == SnackbarResult.ActionPerformed) current.undo?.invoke()
                vm.consumeToast()
            }

            LaunchedEffect(start, settings.onboarded) {
                if (!settings.onboarded) return@LaunchedEffect
                when (start) {
                    StartDestination.NewTask -> navController.navigate(Routes.edit())
                    StartDestination.Today -> {
                        vm.setFilter(TaskFilter.TODAY)
                        navController.navigate(Routes.TASKS)
                    }
                    StartDestination.Calendar -> navController.navigate(Routes.CALENDAR)
                    is StartDestination.TaskDetail -> navController.navigate(Routes.detail(start.id))
                    is StartDestination.SharedText -> {
                        vm.prepareImport(start.text)
                        navController.navigate(Routes.IMPORT)
                    }
                    StartDestination.None -> Unit
                }
            }

            Box(
                Modifier
                    .fillMaxSize()
                    .background(colors.background)
                    .statusBarsPadding()
            ) {
                NavHost(
                    navController = navController,
                    startDestination = if (settings.onboarded) Routes.HOME else Routes.ONBOARDING,
                    modifier = Modifier.fillMaxSize()
                ) {
                    composable(Routes.ONBOARDING) {
                        OnboardingScreen { name ->
                            if (name.isNotBlank()) vm.setUserName(name.trim())
                            vm.setOnboarded(true)
                            navController.navigate(Routes.HOME) {
                                popUpTo(Routes.ONBOARDING) { inclusive = true }
                            }
                        }
                    }
                    composable(Routes.HOME) {
                        HomeScreen(
                            vm = vm,
                            onOpenTask = { navController.navigate(Routes.detail(it)) },
                            onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                            onOpenTasks = { navController.navigate(Routes.TASKS) },
                            onOpenTemplates = { navController.navigate(Routes.TEMPLATES) },
                            onNewTask = { navController.navigate(Routes.edit()) },
                            onOpenPaywall = { navController.navigate(Routes.PAYWALL) },
                            onOpenAccount = { navController.navigate(Routes.ACCOUNT) },
                            onStartVoice = startVoice
                        )
                    }
                    composable(Routes.TASKS) {
                        TasksScreen(
                            vm = vm,
                            onOpenTask = { navController.navigate(Routes.detail(it)) },
                            onNewTask = { navController.navigate(Routes.edit()) },
                            onOpenProjects = { navController.navigate(Routes.PROJECTS) },
                            onOpenMatrix = { navController.navigate(Routes.MATRIX) }
                        )
                    }
                    composable(Routes.CALENDAR) {
                        CalendarScreen(vm) { navController.navigate(Routes.detail(it)) }
                    }
                    composable(Routes.REPORTS) { ReportsScreen(vm) }
                    composable(Routes.SETTINGS) {
                        SettingsScreen(
                            vm = vm,
                            onBack = { navController.popBackStack() },
                            onOpenProjects = { navController.navigate(Routes.PROJECTS) },
                            onOpenAbout = { navController.navigate(Routes.ABOUT) },
                            onOpenPaywall = { navController.navigate(Routes.PAYWALL) },
                            onOpenArchive = { navController.navigate(Routes.ARCHIVE) },
                            onOpenAccount = { navController.navigate(Routes.ACCOUNT) }
                        )
                    }
                    composable(Routes.PROJECTS) {
                        ProjectsScreen(vm) { navController.popBackStack() }
                    }
                    composable(Routes.ABOUT) {
                        AboutScreen { navController.popBackStack() }
                    }
                    composable(Routes.PAYWALL) {
                        PaywallScreen(vm) { navController.popBackStack() }
                    }
                    composable(Routes.ACCOUNT) {
                        AccountScreen(vm) { navController.popBackStack() }
                    }
                    composable(Routes.IMPORT) {
                        ImportScreen(
                            vm = vm,
                            onBack = { navController.popBackStack() },
                            onDone = {
                                navController.popBackStack()
                                navController.navigate(Routes.TASKS)
                            }
                        )
                    }
                    composable(Routes.MATRIX) {
                        MatrixScreen(
                            vm = vm,
                            onOpenTask = { navController.navigate(Routes.detail(it)) },
                            onBack = { navController.popBackStack() }
                        )
                    }
                    composable(Routes.ARCHIVE) {
                        ArchiveScreen(
                            vm = vm,
                            onOpenTask = { navController.navigate(Routes.detail(it)) },
                            onBack = { navController.popBackStack() }
                        )
                    }
                    composable(
                        Routes.FOCUS,
                        arguments = listOf(navArgument("taskId") { type = NavType.LongType })
                    ) { entry ->
                        FocusScreen(
                            vm = vm,
                            taskId = entry.arguments?.getLong("taskId") ?: -1L,
                            onBack = { navController.popBackStack() }
                        )
                    }
                    composable(Routes.TEMPLATES) {
                        TemplatesScreen(
                            vm = vm,
                            onCreated = { id ->
                                navController.popBackStack()
                                navController.navigate(Routes.detail(id))
                            },
                            onBack = { navController.popBackStack() }
                        )
                    }
                    composable(
                        Routes.DETAIL,
                        arguments = listOf(navArgument("taskId") { type = NavType.LongType })
                    ) { entry ->
                        TaskDetailScreen(
                            vm = vm,
                            taskId = entry.arguments?.getLong("taskId") ?: -1L,
                            onBack = { navController.popBackStack() },
                            onEdit = { navController.navigate(Routes.edit(it)) },
                            onOpenFocus = { navController.navigate(Routes.focus(it)) }
                        )
                    }
                    composable(
                        Routes.EDIT,
                        arguments = listOf(
                            navArgument("taskId") { type = NavType.LongType; defaultValue = -1L }
                        )
                    ) { entry ->
                        val id = entry.arguments?.getLong("taskId") ?: -1L
                        TaskEditScreen(
                            vm = vm,
                            taskId = id.takeIf { it > 0 },
                            onDone = { navController.popBackStack() }
                        )
                    }
                }

                SnackbarHost(
                    hostState = snackbarHost,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(bottom = if (showNav) 96.dp else 16.dp, start = 16.dp, end = 16.dp)
                ) { data ->
                    Snackbar(
                        snackbarData = data,
                        containerColor = colors.ink,
                        contentColor = androidx.compose.ui.graphics.Color.White,
                        actionColor = colors.accent
                    )
                }

                val voiceState by vm.voice.collectAsStateWithLifecycle()
                VoiceSheet(
                    state = voiceState,
                    onStop = { vm.stopListening() },
                    onRetry = startVoice,
                    onToggle = { vm.toggleVoiceCandidate(it) },
                    onConfirm = { vm.confirmVoice() },
                    onDismiss = { vm.dismissVoice() }
                )

                if (showNav) {
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .navigationBarsPadding()
                            .padding(bottom = 10.dp)
                    ) {
                        BottomNavPill(
                            items = navItems,
                            currentRoute = route ?: Routes.HOME,
                            onSelect = { target ->
                                if (target != route) {
                                    navController.navigate(target) {
                                        popUpTo(Routes.HOME) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            onAdd = { navController.navigate(Routes.edit()) }
                        )
                    }
                }
            }
        }
    }
}

/** شاشة القفل قبل إظهار المحتوى */
@Composable
fun LockScreen(onUnlock: () -> Unit) {
    val colors = MahamiTheme.colors
    Box(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentAlignment = Alignment.Center
    ) {
        Text(
            "المس لفتح التطبيق",
            style = MaterialTheme.typography.titleLarge,
            color = colors.inkMuted,
            modifier = Modifier
                .padding(24.dp)
                .background(colors.surface)
                .padding(24.dp)
        )
    }
    LaunchedEffect(Unit) { onUnlock() }
}
