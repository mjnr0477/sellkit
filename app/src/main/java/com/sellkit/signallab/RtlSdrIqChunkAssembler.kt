package com.sellkit.signallab

/**
 * Buffers arbitrary USB read chunks into complete interleaved I/Q byte pairs.
 *
 * USB bulk reads may end on an odd byte boundary. Passing such a chunk directly
 * to the sample converter would reject it or lose I/Q alignment. This class
 * retains at most one trailing byte between calls. It does not open USB or
 * prove that bytes came from a live radio.
 */
class RtlSdrIqChunkAssembler {
    private var pendingI: Byte? = null

    /**
     * Returns an even-length array of interleaved I/Q bytes. If the input ends
     * with an incomplete pair, that final byte is retained for the next call.
     */
    @Synchronized
    fun append(chunk: ByteArray): ByteArray {
        if (chunk.isEmpty()) return ByteArray(0)

        val hasPending = pendingI != null
        val start = if (hasPending) 1 else 0
        val available = chunk.size - start
        val completeCount = available - (available % 2)
        val outputSize = completeCount + if (hasPending) 2 else 0
        val output = ByteArray(outputSize)
        var out = 0

        if (hasPending) {
            output[out++] = pendingI!!
            output[out++] = chunk[0]
            pendingI = null
        }

        if (completeCount > 0) {
            System.arraycopy(chunk, start, output, out, completeCount)
        }

        val consumed = start + completeCount
        if (consumed < chunk.size) {
            pendingI = chunk[consumed]
        }
        return output
    }

    /** Clears any partial I/Q pair, for example when a radio stream stops. */
    @Synchronized
    fun reset() {
        pendingI = null
    }

    @Synchronized
    fun hasIncompletePair(): Boolean = pendingI != null
}
