package com.sellkit.signallab

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UsbRadioDiscoveryTest {
    @Test
    fun recognizesCommonRtlSdrIdentifiers() {
        val supported = listOf(
            0x2832, // RTL2832U generic
            0x2838, // common RTL-SDR
            0x2837,
            0x2840,
            0x2836
        )
        supported.forEach { productId ->
            assertTrue(
                "Expected common RTL-SDR product ID 0x" + productId.toString(16),
                UsbRadioDiscovery.isLikelyRtlSdr(0x0bda, productId)
            )
        }
        assertTrue(UsbRadioDiscovery.isLikelyRtlSdr(0x1d19, 0x1101))
        assertTrue(UsbRadioDiscovery.isLikelyRtlSdr(0x1d19, 0x1102))
    }

    @Test
    fun rejectsUnrecognizedAndWrongVendorIdentifiers() {
        assertFalse(UsbRadioDiscovery.isLikelyRtlSdr(0x1234, 0x2838))
        assertFalse(UsbRadioDiscovery.isLikelyRtlSdr(0x0bda, 0xffff))
    }
}
