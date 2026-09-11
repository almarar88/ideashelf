package ai.pacto.app.platform.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Records a live negotiation. Amplitude is sampled while recording so the turn segmenter can
 * split the session into two sides without sending a single second of audio off the device.
 */
class VoiceSessionRecorder(private val context: Context) {

    data class AmplitudeSample(val atMillis: Long, val amplitude: Int)

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startedAt: Long = 0L
    private val samples = mutableListOf<AmplitudeSample>()

    val isRecording: Boolean get() = recorder != null

    fun start(): File {
        stop()
        val dir = File(context.filesDir, "recordings").apply { mkdirs() }
        val file = File(dir, "session_${System.currentTimeMillis()}.m4a")
        val created = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        created.apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioSamplingRate(44_100)
            setAudioEncodingBitRate(96_000)
            setOutputFile(file.absolutePath)
            prepare()
            start()
        }
        recorder = created
        outputFile = file
        startedAt = System.currentTimeMillis()
        samples.clear()
        return file
    }

    /** Called on a timer while recording; returns the current level for the waveform. */
    fun sampleAmplitude(): Int {
        val current = recorder ?: return 0
        val amplitude = runCatching { current.maxAmplitude }.getOrDefault(0)
        samples += AmplitudeSample(System.currentTimeMillis() - startedAt, amplitude)
        return amplitude
    }

    fun stop(): File? {
        val current = recorder ?: return null
        runCatching {
            current.stop()
        }
        runCatching { current.release() }
        recorder = null
        return outputFile
    }

    fun collectedSamples(): List<AmplitudeSample> = samples.toList()

    fun durationMillis(): Long = if (startedAt == 0L) 0 else System.currentTimeMillis() - startedAt
}
