package com.sellkit.signallab

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SignalDecoderTest {
    @Test fun estimatesPowerForKnownSamples() {
        val result = SignalDecoder.analyzeIq(floatArrayOf(1f, 0f, 0f, 1f))
        assertEquals(2, result.sampleCount)
        assertEquals(1.0, result.meanPower, 1e-9)
        assertEquals(1.0, result.rmsAmplitude, 1e-9)
    }

    @Test fun estimatesDifferentialBpskPhaseChanges() {
        // Phases: 0, 0, pi, pi -> differential bits: 0, 1, 0.
        val result = SignalDecoder.analyzeIq(
            floatArrayOf(1f, 0f, 1f, 0f, -1f, 0f, -1f, 0f)
        )
        assertEquals(listOf(0, 1, 0), result.estimatedDifferentialBits)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsOddNumberOfIqValues() {
        SignalDecoder.analyzeIq(floatArrayOf(1f, 0f, 0f))
    }

    @Test fun reportsItsLimitations() {
        assertTrue(SignalDecoder.analyzeIq(floatArrayOf(1f, 0f)).note.contains("No RF capture"))
    }
}
