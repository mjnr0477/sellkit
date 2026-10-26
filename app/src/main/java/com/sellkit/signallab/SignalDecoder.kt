package com.sellkit.signallab

import kotlin.math.atan2
import kotlin.math.sqrt

/**
 * First-stage DSP for complex baseband samples supplied by a compatible SDR receiver.
 *
 * This class does not access the phone modem or capture RF by itself. A supported
 * receiver/driver must supply interleaved I/Q samples. It measures signal quality
 * and estimates differential BPSK symbols as a research primitive; a complete
 * protocol still needs timing recovery, framing, error correction, and a valid
 * network layer before any internet connectivity can exist.
 */
object SignalDecoder {
    data class Analysis(
        val sampleCount: Int,
        val meanPower: Double,
        val rmsAmplitude: Double,
        val meanPhaseRadians: Double,
        val estimatedDifferentialBits: List<Int>,
        val note: String
    )

    /**
     * Analyze interleaved I,Q floating point samples: [I0,Q0,I1,Q1,...].
     * Values should be normalized near -1..1. Odd-length or non-finite input is rejected.
     */
    fun analyzeIq(samples: FloatArray): Analysis {
        require(samples.isNotEmpty() && samples.size % 2 == 0) {
            "I/Q input must contain non-empty interleaved I,Q pairs"
        }
        require(samples.all { it.isFinite() }) { "I/Q samples must be finite numbers" }

        val count = samples.size / 2
        var powerSum = 0.0
        var phaseSin = 0.0
        var phaseCos = 0.0
        val phases = DoubleArray(count)

        for (n in 0 until count) {
            val i = samples[2 * n].toDouble()
            val q = samples[2 * n + 1].toDouble()
            powerSum += i * i + q * q
            val phase = atan2(q, i)
            phases[n] = phase
            phaseSin += kotlin.math.sin(phase)
            phaseCos += kotlin.math.cos(phase)
        }

        val bits = ArrayList<Int>(maxOf(0, count - 1))
        for (n in 1 until count) {
            var delta = phases[n] - phases[n - 1]
            while (delta > Math.PI) delta -= 2.0 * Math.PI
            while (delta < -Math.PI) delta += 2.0 * Math.PI
            // Differential BPSK's ideal phase change is near 0 or +/- pi.
            // This is a raw estimate only, not a standards-compliant decoder.
            bits.add(if (kotlin.math.abs(delta) > Math.PI / 2.0) 1 else 0)
        }

        val meanPower = powerSum / count
        val meanPhase = atan2(phaseSin, phaseCos)
        return Analysis(
            sampleCount = count,
            meanPower = meanPower,
            rmsAmplitude = sqrt(meanPower),
            meanPhaseRadians = meanPhase,
            estimatedDifferentialBits = bits,
            note = "Raw DSP estimate only. No RF capture, protocol validation, internet route, or free access is established."
        )
    }
}
