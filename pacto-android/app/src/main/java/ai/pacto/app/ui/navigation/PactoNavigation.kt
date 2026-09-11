package ai.pacto.app.ui.navigation

import ai.pacto.app.R
import ai.pacto.app.ui.components.BottomItem
import ai.pacto.app.ui.components.PactoBottomBar
import ai.pacto.app.ui.components.TopoBackground
import ai.pacto.app.ui.screens.CaptureScreen
import ai.pacto.app.ui.screens.ContractDetailScreen
import ai.pacto.app.ui.screens.ContractsScreen
import ai.pacto.app.ui.screens.DisputesScreen
import ai.pacto.app.ui.screens.DraftReviewScreen
import ai.pacto.app.ui.screens.EscrowScreen
import ai.pacto.app.ui.screens.EvidenceScreen
import ai.pacto.app.ui.screens.HomeScreen
import ai.pacto.app.ui.screens.IdentityScreen
import ai.pacto.app.ui.screens.SettingsScreen
import ai.pacto.app.ui.screens.SigningScreen
import ai.pacto.app.ui.state.CaptureViewModel
import ai.pacto.app.ui.state.PactoViewModel
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Balance
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController

object Routes {
    const val HOME = "home"
    const val CONTRACTS = "contracts"
    const val ESCROW = "escrow"
    const val EVIDENCE = "evidence"
    const val DISPUTES = "disputes"
    const val CAPTURE = "capture"
    const val DRAFT = "draft"
    const val SIGN = "sign"
    const val DETAIL = "detail"
    const val IDENTITY = "identity"
    const val SETTINGS = "settings"

    fun detail(contractId: String) = "$DETAIL/$contractId"
    fun sign(contractId: String) = "$SIGN/$contractId"
    fun disputes(contractId: String?) = if (contractId == null) DISPUTES else "$DISPUTES?contract=$contractId"
}

@Composable
fun PactoApp(
    initialRoute: String? = null,
    sharedText: String? = null,
    navController: NavHostController = rememberNavController()
) {
    val pactoViewModel: PactoViewModel = viewModel()
    val captureViewModel: CaptureViewModel = viewModel()
    val snackbarHostState = remember { SnackbarHostState() }
    val message by pactoViewModel.message.collectAsStateWithLifecycle()

    val bottomItems = listOf(
        BottomItem(Routes.HOME, stringResource(R.string.nav_home), Icons.Filled.GridView),
        BottomItem(Routes.CONTRACTS, stringResource(R.string.nav_contracts), Icons.Filled.Description),
        BottomItem(Routes.ESCROW, stringResource(R.string.nav_escrow), Icons.Filled.Lock),
        BottomItem(Routes.EVIDENCE, stringResource(R.string.nav_evidence), Icons.Filled.CameraAlt),
        BottomItem(Routes.DISPUTES, stringResource(R.string.nav_disputes), Icons.Filled.Balance)
    )

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    LaunchedEffect(sharedText) {
        if (!sharedText.isNullOrBlank()) {
            captureViewModel.setTranscript(sharedText)
            navController.navigate(Routes.CAPTURE)
        }
    }

    LaunchedEffect(initialRoute) {
        if (initialRoute != null) navController.navigate(initialRoute)
    }

    LaunchedEffect(message) {
        message?.let {
            snackbarHostState.showSnackbar(it)
            pactoViewModel.consumeMessage()
        }
    }

    TopoBackground {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            NavHost(
                navController = navController,
                startDestination = Routes.HOME,
                modifier = Modifier.fillMaxSize()
            ) {
                composable(Routes.HOME) {
                    HomeScreen(
                        viewModel = pactoViewModel,
                        onNewContract = { navController.navigate(Routes.CAPTURE) },
                        onOpenContract = { navController.navigate(Routes.detail(it)) },
                        onOpenEscrow = { navController.navigate(Routes.ESCROW) },
                        onOpenEvidence = { navController.navigate(Routes.EVIDENCE) },
                        onOpenIdentity = { navController.navigate(Routes.IDENTITY) },
                        onOpenSettings = { navController.navigate(Routes.SETTINGS) }
                    )
                }

                composable(Routes.CONTRACTS) {
                    ContractsScreen(
                        viewModel = pactoViewModel,
                        onOpenContract = { navController.navigate(Routes.detail(it)) },
                        onNewContract = { navController.navigate(Routes.CAPTURE) }
                    )
                }

                composable(Routes.ESCROW) {
                    EscrowScreen(
                        viewModel = pactoViewModel,
                        onOpenContract = { navController.navigate(Routes.detail(it)) }
                    )
                }

                composable(Routes.EVIDENCE) {
                    EvidenceScreen(
                        viewModel = pactoViewModel,
                        onOpenContract = { navController.navigate(Routes.detail(it)) }
                    )
                }

                composable(Routes.DISPUTES) {
                    DisputesScreen(
                        viewModel = pactoViewModel,
                        onOpenContract = { navController.navigate(Routes.detail(it)) }
                    )
                }

                composable("${Routes.DISPUTES}?contract={contract}") { entry ->
                    DisputesScreen(
                        viewModel = pactoViewModel,
                        focusContractId = entry.arguments?.getString("contract"),
                        onOpenContract = { navController.navigate(Routes.detail(it)) }
                    )
                }

                composable(Routes.CAPTURE) {
                    CaptureScreen(
                        viewModel = captureViewModel,
                        onDraftReady = { navController.navigate(Routes.DRAFT) }
                    )
                }

                composable(Routes.DRAFT) {
                    DraftReviewScreen(
                        viewModel = captureViewModel,
                        onContinue = { draft ->
                            pactoViewModel.saveDraft(draft) {
                                captureViewModel.reset()
                                navController.navigate(Routes.sign(draft.id)) {
                                    popUpTo(Routes.HOME)
                                }
                            }
                        }
                    )
                }

                composable("${Routes.SIGN}/{contractId}") { entry ->
                    val contractId = entry.arguments?.getString("contractId").orEmpty()
                    val contracts by pactoViewModel.contracts.collectAsStateWithLifecycle()
                    val contract = contracts.firstOrNull { it.id == contractId }
                    if (contract != null) {
                        SigningScreen(
                            contract = contract,
                            viewModel = pactoViewModel,
                            onSigned = { signedId ->
                                navController.navigate(Routes.detail(signedId)) {
                                    popUpTo(Routes.HOME)
                                }
                            }
                        )
                    }
                }

                composable("${Routes.DETAIL}/{contractId}") { entry ->
                    ContractDetailScreen(
                        contractId = entry.arguments?.getString("contractId").orEmpty(),
                        viewModel = pactoViewModel,
                        onOpenDispute = { navController.navigate(Routes.disputes(it)) }
                    )
                }

                composable(Routes.IDENTITY) { IdentityScreen(viewModel = pactoViewModel) }

                composable(Routes.SETTINGS) { SettingsScreen(viewModel = pactoViewModel) }
            }

            PactoBottomBar(
                items = bottomItems,
                currentRoute = currentRoute,
                onSelect = { route ->
                    navController.navigate(route) {
                        popUpTo(Routes.HOME) { inclusive = false }
                        launchSingleTop = true
                    }
                },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
            )

            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}
