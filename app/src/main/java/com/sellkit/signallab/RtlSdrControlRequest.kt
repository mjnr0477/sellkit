package com.sellkit.signallab

/**
 * Describes one USB control-transfer request for the RTL2832U/RTL-SDR protocol.
 *
 * This is deliberately only a validated request model. It does not send USB
 * traffic, initialize the demodulator, identify a tuner, or prove a device is
 * compatible. Hardware initialization must be implemented and tested against
 * an actual supported receiver before the bulk reader can be treated as live I/Q.
 */
data class RtlSdrControlRequest(
    val requestType: Int,
    val request: Int,
    val value: Int,
    val index: Int,
    val payload: ByteArray = byteArrayOf(),
    val expectedReadLength: Int = 0
) {
    init {
        require(requestType in 0..0xFF) { "requestType must fit in one byte" }
        require(request in 0..0xFF) { "request must fit in one byte" }
        require(value in 0..0xFFFF) { "value must fit in two bytes" }
        require(index in 0..0xFFFF) { "index must fit in two bytes" }
        require(expectedReadLength >= 0) { "expectedReadLength cannot be negative" }
        require(payload.isEmpty() || expectedReadLength == 0) {
            "A control request cannot carry both write payload and expected read data"
        }
        require(payload.size <= 0xFFFF) { "payload is too large for a USB control transfer" }
        require(expectedReadLength <= 0xFFFF) { "read length is too large for a USB control transfer" }
    }

    val isRead: Boolean
        get() = expectedReadLength > 0

    companion object {
        /** Standard USB vendor request type, device recipient, host-to-device. */
        const val VENDOR_OUT_DEVICE = 0x40
        /** Standard USB vendor request type, device recipient, device-to-host. */
        const val VENDOR_IN_DEVICE = 0xC0
    }
}
