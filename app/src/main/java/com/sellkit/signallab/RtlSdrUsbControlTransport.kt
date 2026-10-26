package com.sellkit.signallab

import android.hardware.usb.UsbDeviceConnection

/**
 * Executes a prevalidated USB control request on an already-open USB connection.
 *
 * This transport intentionally does not guess register sequences or tuner type.
 * RTL-SDR initialization must use a documented sequence for the detected
 * chipset/tuner; a successful USB transfer alone does not prove RF is initialized.
 */
class RtlSdrUsbControlTransport(
    private val connection: UsbDeviceConnection,
    private val timeoutMs: Int = DEFAULT_TIMEOUT_MS
) {
    init {
        require(timeoutMs > 0) { "timeoutMs must be positive" }
    }

    /**
     * Returns read bytes for read requests, null for a successful write, or a
     * descriptive failure. USB controlTransfer returns a byte count or a
     * negative value on failure; partial transfers are rejected.
     */
    fun execute(request: RtlSdrControlRequest): Result {
        val read = request.isRead
        val transferBuffer = if (read) {
            ByteArray(request.expectedReadLength)
        } else {
            request.payload.copyOf()
        }
        val length = if (read) request.expectedReadLength else request.payload.size

        val transferred = try {
            connection.controlTransfer(
                request.requestType,
                request.request,
                request.value,
                request.index,
                transferBuffer,
                length,
                timeoutMs
            )
        } catch (e: Exception) {
            return Result.Failure("USB control transfer threw ${e.javaClass.simpleName}: ${e.message ?: "no detail"}")
        }

        if (transferred < 0) {
            return Result.Failure("USB control transfer failed (result $transferred).")
        }
        if (transferred != length) {
            return Result.Failure("USB control transfer was partial: expected $length bytes, received $transferred.")
        }
        return if (read) {
            Result.ReadData(transferBuffer)
        } else {
            Result.WriteComplete(transferred)
        }
    }

    sealed class Result {
        data class ReadData(val bytes: ByteArray) : Result()
        data class WriteComplete(val bytesWritten: Int) : Result()
        data class Failure(val reason: String) : Result()
    }

    companion object {
        const val DEFAULT_TIMEOUT_MS = 1000
    }
}
