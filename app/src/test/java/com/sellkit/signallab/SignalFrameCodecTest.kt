package com.sellkit.signallab

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

class SignalFrameCodecTest {
    @Test fun roundTripsKnownLabPayloadAfterNoisePrefix() {
        val payload = "LAB-DATA".toByteArray(Charsets.US_ASCII)
        val frame = SignalFrameCodec.encodeForLab(payload)
        val prefixed = intArrayOf(1, 0, 1, 1, 0, 1) + frame
        val decoded = SignalFrameCodec.decode(prefixed)
        assertNotNull(decoded)
        assertArrayEquals(payload, decoded!!.payload)
        assertEqualsCompat(6, decoded.startBit)
    }

    @Test fun rejectsCorruptedFrame() {
        val frame = SignalFrameCodec.encodeForLab("PAYLOAD".toByteArray(Charsets.US_ASCII))
        frame[frame.lastIndex] = frame.last() xor 1
        assertNull(SignalFrameCodec.decode(frame))
    }

    @Test fun rejectsInvalidBitValues() {
        assertNull(SignalFrameCodec.decode(intArrayOf(0, 1, 2, 0, 1)))
    }

    private fun assertEqualsCompat(expected: Int, actual: Int) {
        org.junit.Assert.assertEquals(expected, actual)
    }
}
