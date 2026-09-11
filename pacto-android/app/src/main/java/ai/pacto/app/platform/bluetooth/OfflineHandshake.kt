package ai.pacto.app.platform.bluetooth

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.IOException
import java.util.UUID

/**
 * Two phones, no network: the contract payload and both signatures travel over a direct RFCOMM
 * link. The bytes exchanged are the canonical contract plus each side's detached signature, so
 * the result is verifiable later by anyone holding the same contract.
 */
class OfflineHandshake(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO)
    private var serverSocket: BluetoothServerSocket? = null
    private var job: Job? = null

    private val adapter: BluetoothAdapter? by lazy {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        manager?.adapter
    }

    fun isSupported(): Boolean = adapter != null
    fun isEnabled(): Boolean = adapter?.isEnabled == true

    fun hasPermission(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    @SuppressLint("MissingPermission")
    fun pairedDevices(): List<BluetoothDevice> =
        if (!hasPermission()) emptyList()
        else runCatching { adapter?.bondedDevices?.toList().orEmpty() }.getOrDefault(emptyList())

    @SuppressLint("MissingPermission")
    fun deviceName(device: BluetoothDevice): String =
        runCatching { device.name }.getOrNull() ?: device.address

    /** Waits for the other phone to connect, then swaps payloads once and closes. */
    @SuppressLint("MissingPermission")
    fun host(payload: String, onResult: (Result<String>) -> Unit) {
        if (!hasPermission()) {
            onResult(Result.failure(SecurityException("إذن البلوتوث غير ممنوح")))
            return
        }
        job = scope.launch {
            try {
                val server = adapter?.listenUsingInsecureRfcommWithServiceRecord(SERVICE_NAME, SERVICE_UUID)
                    ?: throw IOException("البلوتوث غير متاح")
                serverSocket = server
                server.use {
                    val socket = it.accept(ACCEPT_TIMEOUT_MS)
                    val received = exchange(socket, payload)
                    withContext(Dispatchers.Main) { onResult(Result.success(received)) }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onResult(Result.failure(e)) }
            } finally {
                serverSocket = null
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun join(device: BluetoothDevice, payload: String, onResult: (Result<String>) -> Unit) {
        if (!hasPermission()) {
            onResult(Result.failure(SecurityException("إذن البلوتوث غير ممنوح")))
            return
        }
        job = scope.launch {
            try {
                runCatching { adapter?.cancelDiscovery() }
                val socket = device.createInsecureRfcommSocketToServiceRecord(SERVICE_UUID)
                socket.connect()
                val received = exchange(socket, payload)
                withContext(Dispatchers.Main) { onResult(Result.success(received)) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onResult(Result.failure(e)) }
            }
        }
    }

    private fun exchange(socket: BluetoothSocket, payload: String): String = socket.use { open ->
        open.outputStream.write((payload + "\n").toByteArray(Charsets.UTF_8))
        open.outputStream.flush()
        val reader = BufferedReader(open.inputStream.reader(Charsets.UTF_8))
        reader.readLine().orEmpty()
    }

    fun cancel() {
        runCatching { serverSocket?.close() }
        serverSocket = null
        job?.cancel()
        job = null
    }

    private companion object {
        const val SERVICE_NAME = "PactoOfflineHandshake"
        const val ACCEPT_TIMEOUT_MS = 60_000
        val SERVICE_UUID: UUID = UUID.fromString("6f2a1c54-3d41-4b7a-9c22-8b1f0a53e7d1")
    }
}
