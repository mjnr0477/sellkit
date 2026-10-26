package com.sellkit.signallab

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * End-to-end software-only test: lab frame bits -> synthetic differential-BPSK
 * I/Q samples -> DSP bit estimates -> frame/CRC decoder.
 *
 * This proves the software chain on generated samples only; it is not an RF
 * capture or proof of an internet connection.
 */
class SignalPipelineIntegrationTest {
    @Test
    fun decodesLabPayloadFromSyntheticDifferentialBpskIq() {
        val payload = "RADIO-LAB".toByteArray(Charsets.US_ASCII)
        val transmittedBits = SignalFrameCodec.encodeForLab(payload)

        // Differential BPSK: bit 1 flips phase by pi; bit 0 keeps phase.
        // The initial sample establishes the reference phase for the first bit.
        val iq = FloatArray((transmittedBits.size + 1) * 2)
        var phase = 0.0
        iq[0] = cos(phase).toFloat()
        iq[1] = sin(phase).toFloat()
        transmittedBits.forEachIndexed { index, bit ->
            if (bit == 1) phase = (phase + PI) % (2.0 * PI)
            iq[(index + 1) * 2] = cos(phase).toFloat()
            iq[(index + 1) * 2 + 1] = sin(phase).toFloat()
        }

        val analysis = SignalDecoder.analyzeIq(iq)
        val decoded = SignalFrameCodec.decode(analysis.estimatedDifferentialBits.toIntArray())

        assertNotNull("Synthetic I/Q should decode to a valid lab frame", decoded)
        assertArrayEquals(payload, decoded!!.payload)
    }
}
