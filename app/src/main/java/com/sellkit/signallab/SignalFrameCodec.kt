package com.sellkit.signallab

/**
 * Experimental framing layer for bits produced by a radio demodulator.
 *
 * Frame layout: 16-bit sync word 0xDDAA, 8-bit payload length (1..255),
 * payload bytes, then CRC-16/CCITT-FALSE (big-endian). Bits are MSB-first.
 * CRC covers the length byte and payload, excluding sync and CRC.
 * This is a private lab format for controlled experiments, not a public radio
 * standard and not a way to access encrypted/protected transmissions.
 */
object SignalFrameCodec {
    private const val SYNC = 0xDDAA
    private const val SYNC_BITS = 16

    data class DecodedFrame(
        val payload: ByteArray,
        val startBit: Int,
        val totalBits: Int
    )

    fun encodeForLab(payload: ByteArray): IntArray {
        require(payload.isNotEmpty() && payload.size <= 255) { "Payload must contain 1..255 bytes" }
        val bytes = ArrayList<Int>()
        bytes.add((SYNC ushr 8) and 0xff)
        bytes.add(SYNC and 0xff)
        bytes.add(payload.size)
        payload.forEach { bytes.add(it.toInt() and 0xff) }
        // Match the decoder: CRC covers length + payload, not the sync word.
        val crc = crc16Ccitt(bytes.subList(2, bytes.size))
        bytes.add((crc ushr 8) and 0xff)
        bytes.add(crc and 0xff)
        return bytes.flatMap { byte -> (7 downTo 0).map { (byte ushr it) and 1 } }.toIntArray()
    }

    fun decode(bits: IntArray): DecodedFrame? {
        if (bits.any { it != 0 && it != 1 }) return null
        val minBits = SYNC_BITS + 8 + 8 + 16
        if (bits.size < minBits) return null
        for (start in 0..bits.size - minBits) {
            if (readBits(bits, start, SYNC_BITS) != SYNC) continue
            val length = readBits(bits, start + SYNC_BITS, 8)
            if (length !in 1..255) continue
            val total = SYNC_BITS + 8 + length * 8 + 16
            if (start + total > bits.size) continue

            val protectedBytes = ArrayList<Int>(1 + length)
            for (i in 0 until 1 + length) {
                protectedBytes.add(readBits(bits, start + SYNC_BITS + i * 8, 8))
            }
            val crcStart = start + SYNC_BITS + (1 + length) * 8
            val expectedCrc = (readBits(bits, crcStart, 8) shl 8) or
                readBits(bits, crcStart + 8, 8)
            if (crc16Ccitt(protectedBytes) != expectedCrc) continue
            val payload = ByteArray(length) { protectedBytes[1 + it].toByte() }
            return DecodedFrame(payload, start, total)
        }
        return null
    }

    private fun readBits(bits: IntArray, start: Int, count: Int): Int {
        var value = 0
        for (i in 0 until count) value = (value shl 1) or bits[start + i]
        return value
    }

    private fun crc16Ccitt(bytes: List<Int>): Int {
        var crc = 0xffff
        for (byte in bytes) {
            crc = crc xor ((byte and 0xff) shl 8)
            repeat(8) {
                crc = if ((crc and 0x8000) != 0) ((crc shl 1) xor 0x1021) and 0xffff
                else (crc shl 1) and 0xffff
            }
        }
        return crc
    }
}
