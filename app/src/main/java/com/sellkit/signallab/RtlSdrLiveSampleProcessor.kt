package com.sellkit.signallab

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager

/**
 * Connects the USB byte reader to the I/Q assembler and DSP analyzer.
 *
 * This is a transport-to-analysis bridge, not a complete RTL-SDR driver.
 * The caller must obtain permission and configure the demodulator/tuner before
 * starting it; without that initialization the endpoint may not emit I/Q data.
 */
class RtlSdrLiveSampleProcessor(
    private val usbManager: UsbManager,
    private val device: UsbDevice,
    private val onAnalysis: (SignalDecoder.Analysis, receivedBytes: Int, analyzedBytes: Int) -> Unit,
    private val onStopped: (String?) -> Unit
) {
    private val session = RtlSdrStreamingSession()
    @Volatile private var reader: RtlSdrUsbBulkReader? = null

    @Synchronized
    fun start(): String? {
        if (reader?.isRunning() == true) return "Sample processor is already running."
        session.reset()
        val newReader = RtlSdrUsbBulkReader(
            usbManager = usbManager,
            device = device,
            onChunk = { chunk ->
                val result = session.acceptUsbChunk(chunk)
                val analysis = result.analysis
                if (analysis != null) {
                    onAnalysis(analysis, result.receivedByteCount, result.analyzedByteCount)
                }
            },
            onStopped = { reason ->
                synchronized(this) { reader = null }
                onStopped(reason)
            }
        )
        val error = newReader.start()
        if (error != null) return error
        reader = newReader
        return null
    }

    @Synchronized
    fun stop() {
        reader?.stop()
    }

    fun isRunning(): Boolean = reader?.isRunning() == true
}
