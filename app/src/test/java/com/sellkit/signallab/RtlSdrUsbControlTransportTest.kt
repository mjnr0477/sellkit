package com.sellkit.signallab

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RtlSdrUsbControlTransportTest {
    @Test
    fun successfulWriteReturnsByteCountAndForwardsRequestFields() {
        var seenPayload = byteArrayOf()
        var seenFields = listOf<Int>()
        val transport = RtlSdrUsbControlTransport(
            transferForTest = { type, request, value, index, buffer, length, timeout ->
                seenPayload = buffer.copyOf(length)
                seenFields = listOf(type, request, value, index, length, timeout)
                length
            },
            timeoutMs = 250
        )
        val result = transport.execute(
            RtlSdrControlRequest(0x40, 5, 0x1234, 0x20, byteArrayOf(0x12, 0x34))
        )

        assertEquals(RtlSdrUsbControlTransport.Result.WriteComplete(2), result)
        assertArrayEquals(byteArrayOf(0x12, 0x34), seenPayload)
        assertEquals(listOf(0x40, 5, 0x1234, 0x20, 2, 250), seenFields)
    }

    @Test
    fun successfulReadReturnsReceivedBytes() {
        val transport = RtlSdrUsbControlTransport(
            transferForTest = { _, _, _, _, buffer, length, _ ->
                for (i in 0 until length) buffer[i] = (i + 1).toByte()
                length
            }
        )
        val result = transport.execute(
            RtlSdrControlRequest(0xC0, 0, 0, 0x100, expectedReadLength = 3)
        )

        assertTrue(result is RtlSdrUsbControlTransport.Result.ReadData)
        assertArrayEquals(
            byteArrayOf(1, 2, 3),
            (result as RtlSdrUsbControlTransport.Result.ReadData).bytes
        )
    }

    @Test
    fun negativeTransferResultIsFailure() {
        val transport = RtlSdrUsbControlTransport(
            transferForTest = { _, _, _, _, _, _, _ -> -1 }
        )
        val result = transport.execute(RtlSdrControlRequest(0x40, 0, 0, 0, byteArrayOf(1)))

        assertTrue(result is RtlSdrUsbControlTransport.Result.Failure)
    }

    @Test
    fun partialTransferIsFailure() {
        val transport = RtlSdrUsbControlTransport(
            transferForTest = { _, _, _, _, _, _, _ -> 1 }
        )
        val result = transport.execute(
            RtlSdrControlRequest(0x40, 0, 0, 0, byteArrayOf(1, 2))
        )

        assertTrue(result is RtlSdrUsbControlTransport.Result.Failure)
    }

    @Test
    fun thrownTransferExceptionIsFailure() {
        val transport = RtlSdrUsbControlTransport(
            transferForTest = { _, _, _, _, _, _, _ -> throw IllegalStateException("device gone") }
        )
        val result = transport.execute(RtlSdrControlRequest(0x40, 0, 0, 0, byteArrayOf(1)))

        assertTrue(result is RtlSdrUsbControlTransport.Result.Failure)
        assertTrue((result as RtlSdrUsbControlTransport.Result.Failure).reason.contains("device gone"))
    }
}
