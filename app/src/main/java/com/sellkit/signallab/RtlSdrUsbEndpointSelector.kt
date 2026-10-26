package com.sellkit.signallab

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface

/**
 * Finds a candidate USB bulk-IN endpoint on a detected radio.
 *
 * Endpoint discovery is a prerequisite only: it does not claim the device is
 * initialized, that the endpoint carries I/Q samples, or that samples can be
 * decoded. The RTL-SDR control protocol and tuner initialization are still
 * required before reading samples.
 */
object RtlSdrUsbEndpointSelector {
    data class Candidate(
        val interfaceIndex: Int,
        val endpointAddress: Int,
        val endpointNumber: Int,
        val maxPacketSize: Int
    )

    fun findBulkInputCandidate(device: UsbDevice): Candidate? {
        for (interfaceIndex in 0 until device.interfaceCount) {
            val usbInterface: UsbInterface = device.getInterface(interfaceIndex)
            for (endpointIndex in 0 until usbInterface.endpointCount) {
                val endpoint: UsbEndpoint = usbInterface.getEndpoint(endpointIndex)
                if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                    endpoint.direction == UsbConstants.USB_DIR_IN
                ) {
                    return Candidate(
                        interfaceIndex = interfaceIndex,
                        endpointAddress = endpoint.address,
                        endpointNumber = endpoint.endpointNumber,
                        maxPacketSize = endpoint.maxPacketSize
                    )
                }
            }
        }
        return null
    }
}
