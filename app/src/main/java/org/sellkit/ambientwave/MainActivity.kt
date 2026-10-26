package org.sellkit.ambientwave

import android.app.Activity
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale
import kotlin.math.sqrt

class MainActivity : Activity() {
    private lateinit var resultView: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var activeListener: SensorEventListener? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 32, 28, 28)
        }
        content.addView(TextView(this).apply {
            text = "MAGNETIC FIELD SURVEY"
            textSize = 24f
            gravity = Gravity.CENTER
        })
        content.addView(TextView(this).apply {
            text = "Measure magnetic-field changes using the phone's built-in sensor. Take a baseline reading away from wiring, then repeat near an ordinary, safely enclosed powered cable while keeping the phone in the same orientation."
            textSize = 16f
            setPadding(0, 20, 0, 20)
        })
        content.addView(Button(this).apply {
            text = "Start 8-second survey"
            setOnClickListener { startSurvey() }
        })
        resultView = TextView(this).apply {
            textSize = 16f
            setPadding(0, 24, 0, 12)
            text = "Ready. Keep the phone still during each survey."
        }
        content.addView(resultView)
        content.addView(TextView(this).apply {
            textSize = 13f
            text = "Important: this sensor does not decode internet data or prove that a cable carries network signals. Readings are affected by phone orientation, Earth's magnetic field, magnets, speakers, motors and appliances. Never open outlets or touch exposed conductors."
            setPadding(0, 20, 0, 0)
        })
        setContentView(ScrollView(this).apply { addView(content) })
    }

    private fun startSurvey() {
        if (activeListener != null) {
            resultView.text = "A survey is already running. Please wait for it to finish."
            return
        }

        val manager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        if (sensor == null) {
            resultView.text = "This phone does not expose a magnetic-field sensor to Android."
            return
        }

        val samples = mutableListOf<FloatArray>()
        val startedAt = System.currentTimeMillis()
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                if (event.sensor.type == Sensor.TYPE_MAGNETIC_FIELD && event.values.size >= 3) {
                    samples.add(floatArrayOf(event.values[0], event.values[1], event.values[2]))
                }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        activeListener = listener
        resultView.text = "Survey running for 8 seconds… Hold the phone still and keep it away from magnets."
        if (!manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) {
            activeListener = null
            resultView.text = "Could not start the magnetic-field sensor."
            return
        }

        handler.postDelayed({
            manager.unregisterListener(listener)
            activeListener = null
            resultView.text = buildString {
                append("SURVEY RESULTS\n\n")
                append("Duration: ").append((System.currentTimeMillis() - startedAt) / 1000).append(" seconds\n")
                append("Samples: ").append(samples.size).append("\n")
                if (samples.isEmpty()) {
                    append("No readings were returned. Try again.\n")
                } else {
                    val magnitudes = samples.map { v ->
                        sqrt((v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).toDouble()).toFloat()
                    }
                    val average = magnitudes.average()
                    val minimum = magnitudes.minOrNull() ?: 0f
                    val maximum = magnitudes.maxOrNull() ?: 0f
                    append(String.format(Locale.US, "Average field: %.2f µT\n", average))
                    append(String.format(Locale.US, "Minimum: %.2f µT\n", minimum))
                    append(String.format(Locale.US, "Maximum: %.2f µT\n", maximum))
                    append(String.format(Locale.US, "Variation range: %.2f µT\n", maximum - minimum))
                    append(String.format(Locale.US, "Mean axes: X %.2f, Y %.2f, Z %.2f µT\n",
                        samples.map { it[0] }.average(),
                        samples.map { it[1] }.average(),
                        samples.map { it[2] }.average()))
                }
                append("\nRepeat away from the cable and near it several times, with the same phone orientation. Compare the results; one reading alone is not evidence of a cable signal.")
            }
        }, 8000L)
    }

    override fun onDestroy() {
        activeListener?.let { (getSystemService(Context.SENSOR_SERVICE) as SensorManager).unregisterListener(it) }
        activeListener = null
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
