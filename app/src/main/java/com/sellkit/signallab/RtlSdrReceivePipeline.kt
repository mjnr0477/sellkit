package com.sellkit.signallab

/**
 * Narrow bridge from a future RTL-SDR USB read to the existing DSP analyzer.
 *
 * This deliberately accepts a byte buffer rather than opening USB itself, so
 * the receiver driver can be implemented and tested independently. Calling this
 * function with fabricated bytes is not evidence of live RF reception.
 */
object RtlSdrReceivePipeline {
    data class Result(
        val inputByteCount: Int,
        val analysis: SignalDecoder.Analysis
    )

    fun analyzeUnsignedIqBytes(rawIq: ByteArray): Result {
        val floats = RtlSdrSampleConverter.unsigned8ToInterleavedIq(rawIq)
        return Result(
            inputByteCount = rawIq.size,
            analysis = SignalDecoder.analyzeIq(floats)
        )
    }
}
