package com.sellkit.signallab

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RtlSdrReceivePipelineTest {
    @Test
    fun rawIqBytesReachAnalyzerThroughConversionBridge() {
        // Repeating non-identical I/Q pairs exercises the full byte-to-DSP path.
        val raw = byteArrayOf(
            255.toByte(), 128.toByte(),
            128.toByte(), 255.toByte(),
            0, 128.toByte(),
            128.toByte(), 0
        )
        val result = RtlSdrReceivePipeline.analyzeUnsignedIqBytes(raw)

        assertEquals(raw.size, result.inputByteCount)
        assertEquals(raw.size / 2, result.analysis.sampleCount)
        assertEquals(raw.size / 2 - 1, result.analysis.estimatedDifferentialBits.size)
        assertTrue(result.analysis.meanPower > 0.0)
    }

    @Test
    fun rejectsIncompleteUsbReadInsteadOfSilentlyTruncating() {
        org.junit.Assert.assertThrows(IllegalArgumentException::class.java) {
            RtlSdrReceivePipeline.analyzeUnsignedIqBytes(byteArrayOf(1, 2, 3))
        }
    }
}
