package ai.pacto.app.ui.state

import ai.pacto.app.PactoApplication
import ai.pacto.app.domain.engine.ContractFactory
import ai.pacto.app.domain.engine.ExtractionResult
import ai.pacto.app.domain.engine.Loophole
import ai.pacto.app.domain.engine.LoopholeDetector
import ai.pacto.app.domain.engine.SpeakerTurn
import ai.pacto.app.domain.engine.TermExtractor
import ai.pacto.app.domain.model.CaptureSource
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.data.SampleData
import ai.pacto.app.platform.audio.SpeakerSegmenter
import ai.pacto.app.platform.audio.VoiceSessionRecorder
import ai.pacto.app.platform.speech.SpeechTranscriber
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class CaptureMode { VOICE, CHAT, MANUAL }

data class CaptureUiState(
    val mode: CaptureMode = CaptureMode.VOICE,
    val isRecording: Boolean = false,
    val amplitude: Int = 0,
    val transcript: String = "",
    val partialText: String = "",
    val turns: List<SpeakerTurn> = emptyList(),
    val counterpartyName: String = "",
    val counterpartyIsProvider: Boolean = true,
    val extraction: ExtractionResult? = null,
    val draft: Contract? = null,
    val loopholes: List<Loophole> = emptyList(),
    val error: String? = null,
    val quotaBlocked: Boolean = false
)

/**
 * Drives capture and review: record or paste, extract terms on device, show the gaps, and
 * hand a signable draft to the signing screen.
 */
class CaptureViewModel(application: Application) : AndroidViewModel(application) {

    private val container = (application as PactoApplication).container
    private val recorder = VoiceSessionRecorder(application)
    private val transcriber = SpeechTranscriber(application)

    private val _state = MutableStateFlow(CaptureUiState())
    val state: StateFlow<CaptureUiState> = _state.asStateFlow()

    fun setMode(mode: CaptureMode) {
        _state.value = _state.value.copy(mode = mode, error = null)
    }

    fun setTranscript(text: String) {
        _state.value = _state.value.copy(transcript = text)
    }

    fun setCounterparty(name: String) {
        _state.value = _state.value.copy(counterpartyName = name)
    }

    fun setCounterpartyIsProvider(isProvider: Boolean) {
        _state.value = _state.value.copy(counterpartyIsProvider = isProvider)
    }

    fun loadSampleConversation() {
        setTranscript(SAMPLE_CONVERSATION)
        setMode(CaptureMode.CHAT)
    }

    fun startRecording() {
        if (_state.value.isRecording) return
        runCatching { recorder.start() }
            .onFailure {
                _state.value = _state.value.copy(error = "تعذر بدء التسجيل: ${it.message}")
                return
            }
        _state.value = _state.value.copy(isRecording = true, error = null, turns = emptyList())

        viewModelScope.launch {
            while (isActive && recorder.isRecording) {
                _state.value = _state.value.copy(amplitude = recorder.sampleAmplitude())
                delay(100)
            }
        }

        transcriber.start(
            languageTag = "ar",
            preferOffline = true,
            callback = object : SpeechTranscriber.Callback {
                override fun onPartial(text: String) {
                    _state.value = _state.value.copy(partialText = text)
                }

                override fun onFinal(chunks: List<String>) {
                    applyRecognisedChunks(chunks)
                }

                override fun onError(message: String) {
                    _state.value = _state.value.copy(error = message)
                }
            }
        )
    }

    fun stopRecording() {
        if (!_state.value.isRecording) return
        recorder.stop()
        transcriber.stop()
        val partial = _state.value.partialText
        if (partial.isNotBlank()) applyRecognisedChunks(listOf(partial))
        _state.value = _state.value.copy(isRecording = false, amplitude = 0, partialText = "")
    }

    private fun applyRecognisedChunks(chunks: List<String>) {
        val segments = SpeakerSegmenter.segment(recorder.collectedSamples())
        val turns = SpeakerSegmenter.attachText(segments, chunks, "الطرف الأول" to "الطرف الثاني")
        _state.value = _state.value.copy(
            turns = turns,
            transcript = (chunks.joinToString(" ")).trim()
        )
    }

    /** Runs the on-device extraction and builds a draft that can be reviewed and signed. */
    fun analyze() {
        val current = _state.value
        val settings = container.appSettings.state.value
        if (!settings.canCreateContract) {
            _state.value = current.copy(quotaBlocked = true)
            return
        }
        val text = current.transcript.ifBlank { current.turns.joinToString(" ") { it.text } }
        if (text.isBlank()) {
            _state.value = current.copy(error = "لا يوجد نص لتحليله")
            return
        }

        val extraction = TermExtractor.extract(text, current.turns)
        val me = SampleData.me(settings.currentPartyId, settings.displayName).copy(
            role = if (current.counterpartyIsProvider) PartyRole.CLIENT else PartyRole.PROVIDER
        )
        val draft = ContractFactory.fromExtraction(
            extraction = extraction,
            now = System.currentTimeMillis(),
            me = me,
            counterpartyName = current.counterpartyName,
            counterpartyRole = if (current.counterpartyIsProvider) PartyRole.PROVIDER else PartyRole.CLIENT,
            source = when (current.mode) {
                CaptureMode.VOICE -> CaptureSource.VOICE_SESSION
                CaptureMode.CHAT -> CaptureSource.CHAT_TEXT
                CaptureMode.MANUAL -> CaptureSource.MANUAL
            },
            transcript = text,
            feeBasisPoints = settings.feeBasisPoints
        )

        _state.value = current.copy(
            extraction = extraction,
            draft = draft,
            loopholes = LoopholeDetector.detect(draft),
            error = null,
            quotaBlocked = false
        )
    }

    /** Applying a suggested clause closes the gap and re-runs the detector. */
    fun applyClause(term: ContractTerm) {
        val draft = _state.value.draft ?: return
        val updated = draft.copy(terms = draft.terms + term)
        _state.value = _state.value.copy(draft = updated, loopholes = LoopholeDetector.detect(updated))
    }

    fun dismissLoophole(id: String) {
        _state.value = _state.value.copy(loopholes = _state.value.loopholes.filterNot { it.id == id })
    }

    fun reset() {
        _state.value = CaptureUiState()
    }

    override fun onCleared() {
        recorder.stop()
        transcriber.stop()
        super.onCleared()
    }

    private companion object {
        const val SAMPLE_CONVERSATION =
            "تمام يا أبو سلطان، نبي صيانة أربع مكيفات سبليت في البيت. " +
                "المبلغ 1200 ريال وعربون 300 ريال اليوم، والباقي عند التسليم. " +
                "التسليم خلال 3 أيام، وقطع الغيار على حسابي، والضمان شهر."
    }
}
