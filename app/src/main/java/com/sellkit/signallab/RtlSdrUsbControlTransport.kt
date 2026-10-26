package com.sellkit.signallab

import android.hardware.usb.UsbDeviceConnection

/**
 * Executes a prevalidated USB control request on an already-open USB connection.
 *
 * This transport intentionally does not guess register sequences or tuner type.
 * RTL-SDR initialization must use a documented sequence for the detected
 * chipset/tuner; a successful USB transfer alone does not prove RF is initialized.
 */
class RtlSdrUsbControlTransport private constructor(
    private val transfer: (requestType: Int, request: Int, value: Int, index: Int,
                           buffer: ByteArray, length: Int, timeoutMs: Int) -> Int,
    private val timeoutMs: Int
) {
    constructor(connection: UsbDeviceConnection, timeoutMs: Int = DEFAULT_TIMEOUT_MS) : this(
        transfer = { type, request, value, index, buffer, length, timeout ->
            connection.controlTransfer(type, request, value, index, buffer, length, timeout)
        },
        timeoutMs = timeoutMs
    )

    /** Test seam for exercising transfer result handling without physical USB hardware. */
    internal constructor(
        transferForTest: (Int, Int, Int, Int, ByteArray, Int, Int) -> Int,
        timeoutMs: Int = DEFAULT_TIMEOUT_MS,
        testOnly: Boolean = true
    ) : this(transfer = transferForTest, timeoutMs = timeoutMs)

    init {
        require(timeoutMs > 0) { "timeoutMs must be positive" }
    }

    /** Read data is returned only for a complete transfer; partial and failed transfers are rejected. */
    fun execute(request: RtlSdrControlRequest): Result {
        val read = request.isRead
        val buffer = if (read) ByteArray(request.expectedReadLength) else request.payload.copyOf()
        val length = if (read) request.expectedReadLength else request.payload.size

        val transferred = try {
            transfer(
                request.requestType, request.request, request.value, request.index,
                buffer, length, timeoutMs
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
        return if (read) Result.ReadData(buffer) else Result.WriteComplete(transferred)
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
