package ai.pacto.app

import ai.pacto.app.core.crypto.KeystoreSigner
import ai.pacto.app.data.AppSettings
import ai.pacto.app.data.ContractRepository
import ai.pacto.app.data.JsonStore
import ai.pacto.app.data.SampleData
import ai.pacto.app.platform.bluetooth.OfflineHandshake
import ai.pacto.app.platform.deadline.DeadlineScheduler
import ai.pacto.app.platform.export.CourtFileExporter
import ai.pacto.app.platform.location.LocationProbe
import ai.pacto.app.platform.vision.AssetCapture
import ai.pacto.app.platform.vision.ManualSerialReader
import ai.pacto.app.platform.vision.SerialReader
import android.content.Context
import java.io.File

/** Manual dependency graph: one instance per process, created by [PactoApplication]. */
class PactoContainer(private val context: Context) {

    val appSettings: AppSettings by lazy { AppSettings(context) }

    val contractRepository: ContractRepository by lazy {
        ContractRepository(JsonStore(File(context.filesDir, "contracts.json")))
    }

    val keystoreSigner: KeystoreSigner by lazy { KeystoreSigner() }
    val deadlineScheduler: DeadlineScheduler by lazy { DeadlineScheduler(context) }
    val assetCapture: AssetCapture by lazy { AssetCapture(context) }
    val serialReader: SerialReader by lazy { ManualSerialReader() }
    val locationProbe: LocationProbe by lazy { LocationProbe(context) }
    val offlineHandshake: OfflineHandshake by lazy { OfflineHandshake(context) }
    val courtFileExporter: CourtFileExporter by lazy { CourtFileExporter(context) }

    suspend fun warmUp() {
        val settings = appSettings.state.value
        contractRepository.load {
            SampleData.seed(
                now = System.currentTimeMillis(),
                partyId = settings.currentPartyId,
                myName = settings.displayName,
                currency = settings.currency,
                feeBps = settings.feeBasisPoints
            )
        }
        deadlineScheduler.rescheduleAll(contractRepository.contracts.value)
    }
}
