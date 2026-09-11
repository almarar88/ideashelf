package com.almarar.mahami.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PieChart
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.runtime.CompositionLocalProvider
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
import com.almarar.mahami.ui.screens.CalendarScreen
import com.almarar.mahami.ui.screens.HomeScreen
import com.almarar.mahami.ui.screens.OnboardingScreen
import com.almarar.mahami.ui.screens.ReportsScreen
import com.almarar.mahami.ui.screens.SettingsScreen
import com.almarar.mahami.ui.screens.TaskDetailScreen
import com.almarar.mahami.ui.screens.TaskEditScreen
import com.almarar.mahami.ui.screens.TasksScreen
import com.almarar.mahami.ui.theme.MahamiAppTheme
import com.almarar.mahami.ui.theme.MahamiTheme

object Routes {
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val TASKS = "tasks"
    const val CALENDAR = "calendar"
    const val REPORTS = "reports"
    const val SETTINGS = "settings"
    const val DETAIL = "detail/{taskId}"
    const val EDIT = "edit?taskId={taskId}"

    fun detail(id: Long) = "detail/$id"
    fun edit(id: Long? = null) = if (id == null) "edit?taskId=-1" else "edit?taskId=$id"
}

private val navItems = listOf(
    NavItem(Routes.HOME, Icons.Rounded.Home, "الرئيسية"),
    NavItem(Routes.CALENDAR, Icons.Rounded.CalendarMonth, "التقويم"),
    NavItem(Routes.REPORTS, Icons.Rounded.PieChart, "التقارير"),
    NavItem(Routes.SETTINGS, Icons.Rounded.Person, "حسابي")
)

@Composable
fun MahamiApp(initialTaskId: Long? = null) {
    val vm: MahamiViewModel = viewModel()
    val settings by vm.settings.collectAsStateWithLifecycle()

    MahamiAppTheme(darkTheme = settings.darkMode) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            val navController = rememberNavController()
            val backStack by navController.currentBackStackEntryAsState()
            val route = backStack?.destination?.route
            val showNav = route in setOf(
                Routes.HOME, Routes.TASKS, Routes.CALENDAR, Routes.REPORTS, Routes.SETTINGS
            )
            val colors = MahamiTheme.colors

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
                        OnboardingScreen {
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
                            onOpenTasks = { navController.navigate(Routes.TASKS) }
                        )
                    }
                    composable(Routes.TASKS) {
                        TasksScreen(vm) { navController.navigate(Routes.detail(it)) }
                    }
                    composable(Routes.CALENDAR) {
                        CalendarScreen(vm) { navController.navigate(Routes.detail(it)) }
                    }
                    composable(Routes.REPORTS) { ReportsScreen(vm) }
                    composable(Routes.SETTINGS) {
                        SettingsScreen(vm) { navController.popBackStack() }
                    }
                    composable(
                        Routes.DETAIL,
                        arguments = listOf(navArgument("taskId") { type = NavType.LongType })
                    ) { entry ->
                        val id = entry.arguments?.getLong("taskId") ?: -1L
                        TaskDetailScreen(
                            vm = vm,
                            taskId = id,
                            onBack = { navController.popBackStack() },
                            onEdit = { navController.navigate(Routes.edit(it)) }
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

            androidx.compose.runtime.LaunchedEffect(initialTaskId) {
                if (initialTaskId != null && initialTaskId > 0) {
                    navController.navigate(Routes.detail(initialTaskId))
                }
            }
        }
    }
}
