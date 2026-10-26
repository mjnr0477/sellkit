package com.sellkit.signallab

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RtlSdrIqChunkAssemblerTest {
    @Test
    fun joinsOddChunksWithoutLosingIqAlignment() {
        val assembler = RtlSdrIqChunkAssembler()

        assertArrayEquals(byteArrayOf(1, 2), assembler.append(byteArrayOf(1, 2, 3)))
        assertTrue(assembler.hasIncompletePair())
        assertArrayEquals(byteArrayOf(3, 4, 5, 6), assembler.append(byteArrayOf(4, 5, 6)))
        assertFalse(assembler.hasIncompletePair())
    }

    @Test
    fun supportsOneByteReads() {
        val assembler = RtlSdrIqChunkAssembler()

        assertArrayEquals(byteArrayOf(), assembler.append(byteArrayOf(10)))
        assertArrayEquals(byteArrayOf(10, 11), assembler.append(byteArrayOf(11)))
        assertArrayEquals(byteArrayOf(), assembler.append(byteArrayOf()))
    }

    @Test
    fun resetDiscardsPartialPairAtStreamBoundary() {
        val assembler = RtlSdrIqChunkAssembler()
        assembler.append(byteArrayOf(99))

        assembler.reset()

        assertFalse(assembler.hasIncompletePair())
        assertArrayEquals(byteArrayOf(1, 2), assembler.append(byteArrayOf(1, 2)))
    }

    @Test
    fun preservesAllBytesAcrossSeveralChunks() {
        val assembler = RtlSdrIqChunkAssembler()
        val out = listOf(
            byteArrayOf(1, 2, 3, 4, 5),
            byteArrayOf(6),
            byteArrayOf(7, 8, 9, 10)
        ).flatMap { assembler.append(it).toList() }.toByteArray()

        assertArrayEquals(byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), out)
        assertFalse(assembler.hasIncompletePair())
    }
}
