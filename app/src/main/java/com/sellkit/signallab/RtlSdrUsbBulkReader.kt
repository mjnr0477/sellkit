package com.sellkit.signallab

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Minimal USB bulk-IN transport for a future, initialized SDR driver.
 *
 * Caller must obtain Android USB permission and initialize the RTL-SDR
 * demodulator/tuner before starting this reader. This class only moves bytes;
 * it does not configure RF hardware or prove that bytes are valid I/Q samples.
 */
class RtlSdrUsbBulkReader(
    private val usbManager: UsbManager,
    private val device: UsbDevice,
    private val onChunk: (ByteArray) -> Unit,
    private val onStopped: (String?) -> Unit
) {
    private val running = AtomicBoolean(false)
    @Volatile private var connection: UsbDeviceConnection? = null
    @Volatile private var claimedInterface: android.hardware.usb.UsbInterface? = null
    @Volatile private var readerThread: Thread? = null

    @Synchronized
    fun start(): String? {
        if (running.get()) return "USB reader is already running."
        if (!usbManager.hasPermission(device)) return "USB permission has not been granted."
        val candidate = RtlSdrUsbEndpointSelector.findBulkInputCandidate(device)
            ?: return "No USB bulk-IN endpoint was found on this device."

        val usbInterface = device.getInterface(candidate.interfaceIndex)
        val opened = usbManager.openDevice(device)
            ?: return "Android could not open the USB device."

        if (!opened.claimInterface(usbInterface, true)) {
            opened.close()
            return "Could not claim the USB interface."
        }

        val endpoint = usbInterface.getEndpoint(
            (0 until usbInterface.endpointCount).first { index ->
                val ep = usbInterface.getEndpoint(index)
                ep.address == candidate.endpointAddress
            }
        )
        connection = opened
        claimedInterface = usbInterface
        running.set(true)
        readerThread = Thread({
            var failure: String? = null
            val buffer = ByteArray(16 * 1024)
            try {
                while (running.get()) {
                    val activeConnection = connection ?: break
                    val count = activeConnection.bulkTransfer(endpoint, buffer, buffer.size, 1000)
                    if (count > 0) onChunk(buffer.copyOf(count))
                    // A timeout is expected when no bytes arrive; negative values
                    // can also indicate disconnect or an endpoint/driver problem.
                }
            } catch (e: Exception) {
                failure = "USB read failed: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}"
            } finally {
                running.set(false)
                closeConnection()
                onStopped(failure)
            }
        }, "rtl-sdr-usb-reader").apply {
            isDaemon = true
            start()
        }
        return null
    }

    fun stop() {
        running.set(false)
        // bulkTransfer uses a finite timeout, so the worker can exit promptly.
        readerThread?.interrupt()
    }

    fun isRunning(): Boolean = running.get()

    @Synchronized
    private fun closeConnection() {
        val activeConnection = connection
        val activeInterface = claimedInterface
        connection = null
        claimedInterface = null
        readerThread = null
        if (activeConnection != null) {
            try {
                if (activeInterface != null) activeConnection.releaseInterface(activeInterface)
            } catch (_: Exception) {
                // Best-effort cleanup on disconnect.
            }
            try {
                activeConnection.close()
            } catch (_: Exception) {
                // Best-effort cleanup on disconnect.
            }
        }
    }
}
