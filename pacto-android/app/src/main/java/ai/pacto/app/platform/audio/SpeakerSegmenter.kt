package ai.pacto.app.platform.audio

import ai.pacto.app.domain.engine.SpeakerTurn

/**
 * Splits a two-person conversation into turns using pauses and loudness only. A silence long
 * enough to be a hand-over starts a new turn, and the side that speaks next alternates. This
 * is the on-device fallback; a neural diarizer can replace [segment] behind the same signature
 * without any other screen changing.
 */
object SpeakerSegmenter {

    /** A gap this long between loud samples reads as a hand-over between speakers. */
    private const val TURN_GAP_MS = 900L

    /** Anything below this fraction of the session peak counts as silence. */
    private const val SILENCE_RATIO = 0.18

    data class Segment(val startMs: Long, val endMs: Long, val speakerIndex: Int)

    fun segment(samples: List<VoiceSessionRecorder.AmplitudeSample>): List<Segment> {
        if (samples.isEmpty()) return emptyList()
        val peak = samples.maxOf { it.amplitude }.coerceAtLeast(1)
        val threshold = peak * SILENCE_RATIO

        val segments = mutableListOf<Segment>()
        var speaker = 0
        var segmentStart: Long? = null
        var lastVoiced: Long? = null

        samples.forEach { sample ->
            val voiced = sample.amplitude >= threshold
            if (voiced) {
                val gap = lastVoiced?.let { sample.atMillis - it } ?: 0L
                if (segmentStart == null) {
                    segmentStart = sample.atMillis
                } else if (gap > TURN_GAP_MS) {
                    segments += Segment(segmentStart!!, lastVoiced!!, speaker)
                    speaker = 1 - speaker
                    segmentStart = sample.atMillis
                }
                lastVoiced = sample.atMillis
            }
        }
        val start = segmentStart
        val end = lastVoiced
        if (start != null && end != null && end > start) {
            segments += Segment(start, end, speaker)
        }
        return segments
    }

    /**
     * Attaches recognised text to the segments. When the recogniser returns fewer chunks than
     * segments, the remaining text stays with the last known speaker rather than being dropped.
     */
    fun attachText(
        segments: List<Segment>,
        chunks: List<String>,
        speakerNames: Pair<String, String>
    ): List<SpeakerTurn> {
        if (chunks.isEmpty()) return emptyList()
        if (segments.isEmpty()) {
            return chunks.mapIndexed { index, text ->
                SpeakerTurn(if (index % 2 == 0) speakerNames.first else speakerNames.second, text)
            }
        }
        return chunks.mapIndexed { index, text ->
            val segment = segments.getOrNull(index) ?: segments.last()
            val name = if (segment.speakerIndex == 0) speakerNames.first else speakerNames.second
            SpeakerTurn(name, text)
        }
    }
}
