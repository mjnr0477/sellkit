package com.sellkit.signallab

/**
 * Converts raw RTL-SDR unsigned 8-bit interleaved I/Q bytes to normalized floats.
 *
 * RTL-SDR USB samples are unsigned bytes, with the zero-frequency midpoint near
 * 127.5. This conversion is only a format bridge: it does not configure a tuner,
 * capture USB data, demodulate a standard, or establish internet access.
 */
object RtlSdrSampleConverter {
    /**
     * Convert bytes in [I0,Q0,I1,Q1,...] order to floats approximately in [-1,1].
     * An odd byte count is rejected because it ends in a partial I/Q pair.
     */
    fun unsigned8ToInterleavedIq(samples: ByteArray): FloatArray {
        require(samples.isNotEmpty() && samples.size % 2 == 0) {
            "RTL-SDR input must contain non-empty interleaved I/Q byte pairs"
        }
        return FloatArray(samples.size) { index ->
            ((samples[index].toInt() and 0xff) - 127.5f) / 127.5f
        }
    }
}
