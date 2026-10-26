package com.sellkit.signallab

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager

/**
 * Enumerates USB devices that Android exposes to this app as a first step toward
 * a real SDR input path. Enumeration is not RF capture: a device-specific driver,
 * USB permission, tuner configuration and sample streaming implementation are
 * still required before SignalDecoder can receive I/Q samples.
 */
object UsbRadioDiscovery {
    data class DeviceSummary(
        val deviceName: String,
        val vendorId: Int,
        val productId: Int,
        val interfaceCount: Int,
        val likelyRadioDevice: Boolean
    )

    data class Result(
        val usbHostSupported: Boolean,
        val devices: List<DeviceSummary>,
        val message: String
    )

    fun inspect(context: Context): Result {
        val hasHostFeature = context.packageManager.hasSystemFeature(
            android.content.pm.PackageManager.FEATURE_USB_HOST
        )
        if (!hasHostFeature) {
            return Result(
                usbHostSupported = false,
                devices = emptyList(),
                message = "This Android device does not report USB-host support. No external SDR input path is available through USB on this device."
            )
        }

        val manager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
            ?: return Result(true, emptyList(), "Android USB service is unavailable.")

        val devices = manager.deviceList.values.map { device ->
            DeviceSummary(
                deviceName = device.deviceName,
                vendorId = device.vendorId,
                productId = device.productId,
                interfaceCount = device.interfaceCount,
                likelyRadioDevice = looksLikeRtlSdr(device)
            )
        }.sortedWith(compareByDescending<DeviceSummary> { it.likelyRadioDevice }.thenBy { it.deviceName })

        val message = when {
            devices.isEmpty() ->
                "USB host is supported, but no USB devices are attached. Connect a compatible SDR with an OTG adapter. Detection alone will not capture or decode radio."
            devices.any { it.likelyRadioDevice } ->
                "A USB device matches a common RTL-SDR identifier. This is only a candidate match; no USB permission, tuner control, I/Q streaming, RF decoding, or internet access has been verified."
            else ->
                "USB devices detected, but none matches the common RTL-SDR identifiers checked here. No RF samples have been captured."
        }
        return Result(true, devices, message)
    }

    private fun looksLikeRtlSdr(device: UsbDevice): Boolean {
        // Common RTL2832U-based SDR USB identifiers. Clones may use other IDs.
        val known = setOf(
            0x0bda to 0x2832,
            0x0bda to 0x2838,
            0x1d19 to 0x1101,
            0x1d19 to 0x1102
        )
        return (device.vendorId to device.productId) in known
    }
}
