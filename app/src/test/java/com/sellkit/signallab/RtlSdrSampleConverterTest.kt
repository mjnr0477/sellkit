package com.sellkit.signallab

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RtlSdrSampleConverterTest {
    @Test
    fun convertsUnsignedEndpointsAndMidpoint() {
        val iq = RtlSdrSampleConverter.unsigned8ToInterleavedIq(
            byteArrayOf(0, 127, 128.toByte(), 255.toByte())
        )
        assertEquals(-1.0f, iq[0], 0.0001f)
        assertEquals(0.0f, iq[1], 0.01f)
        assertEquals(0.0f, iq[2], 0.01f)
        assertEquals(1.0f, iq[3], 0.0001f)
    }

    @Test
    fun preservesInterleavedSampleOrder() {
        val iq = RtlSdrSampleConverter.unsigned8ToInterleavedIq(
            byteArrayOf(255.toByte(), 0, 128.toByte(), 128.toByte())
        )
        assertEquals(1.0f, iq[0], 0.0001f)
        assertEquals(-1.0f, iq[1], 0.0001f)
        assertEquals(0.0f, iq[2], 0.01f)
        assertEquals(0.0f, iq[3], 0.01f)
    }

    @Test
    fun rejectsEmptyOrPartialIqPair() {
        assertThrows(IllegalArgumentException::class.java) {
            RtlSdrSampleConverter.unsigned8ToInterleavedIq(byteArrayOf())
        }
        assertThrows(IllegalArgumentException::class.java) {
            RtlSdrSampleConverter.unsigned8ToInterleavedIq(byteArrayOf(1, 2, 3))
        }
    }
}
