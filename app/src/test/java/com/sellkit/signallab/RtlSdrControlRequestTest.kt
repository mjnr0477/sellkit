package com.sellkit.signallab

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RtlSdrControlRequestTest {
    @Test
    fun vendorWriteRequestKeepsFieldsAndPayload() {
        val payload = byteArrayOf(0x12, 0x34)
        val request = RtlSdrControlRequest(
            requestType = RtlSdrControlRequest.VENDOR_OUT_DEVICE,
            request = 0x05,
            value = 0x1234,
            index = 0x0020,
            payload = payload
        )

        assertEquals(0x40, request.requestType)
        assertEquals(0x05, request.request)
        assertEquals(0x1234, request.value)
        assertEquals(0x0020, request.index)
        assertFalse(request.isRead)
        assertTrue(request.payload.contentEquals(payload))
    }

    @Test
    fun vendorReadRequestIsMarkedAsRead() {
        val request = RtlSdrControlRequest(
            requestType = RtlSdrControlRequest.VENDOR_IN_DEVICE,
            request = 0x00,
            value = 0,
            index = 0x0100,
            expectedReadLength = 2
        )

        assertTrue(request.isRead)
        assertEquals(2, request.expectedReadLength)
        assertTrue(request.payload.isEmpty())
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsOutOfRangeRequestType() {
        RtlSdrControlRequest(0x140, 0, 0, 0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsOutOfRangeRegisterValue() {
        RtlSdrControlRequest(0x40, 0, 0x10000, 0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsConflictingReadAndWritePayload() {
        RtlSdrControlRequest(0x40, 0, 0, 0, byteArrayOf(1), expectedReadLength = 1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsNegativeReadLength() {
        RtlSdrControlRequest(0xC0, 0, 0, 0, expectedReadLength = -1)
    }
}
