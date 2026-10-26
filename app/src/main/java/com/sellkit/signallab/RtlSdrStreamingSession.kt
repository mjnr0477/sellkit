package com.sellkit.signallab

/**
 * Stateful adapter for a future USB radio reader that delivers arbitrary-sized
 * chunks. It preserves I/Q pairing across reads and only analyzes complete pairs.
 *
 * This class does not acquire USB samples itself; the caller must supply bytes
 * from a real, configured radio before results can be considered live reception.
 */
class RtlSdrStreamingSession {
    data class ChunkResult(
        val receivedByteCount: Int,
        val analyzedByteCount: Int,
        val analysis: SignalDecoder.Analysis?
    )

    private val assembler = RtlSdrIqChunkAssembler()

    @Synchronized
    fun acceptUsbChunk(rawChunk: ByteArray): ChunkResult {
        val completeIq = assembler.append(rawChunk)
        val analysis = if (completeIq.isEmpty()) null else {
            val samples = RtlSdrSampleConverter.unsigned8ToInterleavedIq(completeIq)
            SignalDecoder.analyzeIq(samples)
        }
        return ChunkResult(
            receivedByteCount = rawChunk.size,
            analyzedByteCount = completeIq.size,
            analysis = analysis
        )
    }

    /** Call whenever the receiver stops or restarts, to prevent stale-byte pairing. */
    @Synchronized
    fun reset() {
        assembler.reset()
    }

    @Synchronized
    fun hasIncompleteIqPair(): Boolean = assembler.hasIncompletePair()
}
