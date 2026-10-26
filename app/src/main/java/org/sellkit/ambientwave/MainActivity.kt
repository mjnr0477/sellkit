package org.sellkit.ambientwave

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Bundle
import android.telephony.CellInfo
import android.telephony.TelephonyManager
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private lateinit var output: TextView
    private val requestCode = 741
    private val needed = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.READ_PHONE_STATE)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 32, 28, 28)
        }
        val heading = TextView(this).apply {
            text = "AMBIENT WAVE LAB"
            textSize = 25f
            gravity = Gravity.CENTER_VERTICAL
        }
        val intro = TextView(this).apply {
            text = "Research prototype • radio environment and real connectivity checks"
            textSize = 15f
            setPadding(0, 12, 0, 18)
        }
        output = TextView(this).apply {
            textSize = 15f
            text = "Ready. Grant location and phone permissions to measure signals Android exposes."
            setPadding(0, 8, 0, 18)
        }
        root.addView(heading)
        root.addView(intro)
        root.addView(actionButton("Measure available radio signals") { measureSignals() })
        root.addView(actionButton("Test actual internet route") { testInternet() })
        root.addView(actionButton("Export experiment log") { exportExperimentLog() })
        root.addView(actionButton("Clear results") { output.text = "Results cleared. Choose a test." })
        root.addView(output)
        val scroll = ScrollView(this).apply { addView(root) }
        setContentView(scroll)
        val missing = needed.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), requestCode)
    }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        setOnClickListener { action() }
    }

    private fun measureSignals() {
        val missing = needed.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), requestCode)
            output.text = "Permission required. Grant it, then tap Measure again."
            return
        }
        val report = StringBuilder("RADIO ENVIRONMENT\n\n")
        try {
            val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            if (!wifi.isWifiEnabled) report.append("Wi-Fi radio is off. Turn it on to scan nearby access-point beacons.\n")
            else {
                @Suppress("DEPRECATION")
                wifi.startScan()
                @Suppress("DEPRECATION")
                val results = wifi.scanResults
                report.append("Visible Wi-Fi access points: ").append(results.size).append("\n")
                results.take(15).forEachIndexed { index, item ->
                    report.append(index + 1).append(". ")
                        .append(if (item.SSID.isNullOrBlank()) "[hidden network]" else item.SSID)
                        .append(" • ").append(item.frequency).append(" MHz • ")
                        .append(item.level).append(" dBm • ").append(item.capabilities)
                        .append("\n")
                }
                report.append("\nAndroid may throttle scans; this is not a complete spectrum measurement.\n")
            }
        } catch (e: Exception) {
            report.append("Wi-Fi scan unavailable: ").append(e.message ?: e.javaClass.simpleName).append("\n")
        }
        try {
            val telephony = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            @Suppress("DEPRECATION")
            val cells: List<CellInfo> = telephony.allCellInfo ?: emptyList()
            report.append("\nCELLULAR RADIO READINGS\n")
            report.append("Registered network type: ").append(telephony.dataNetworkType).append("\n")
            report.append("Cell records exposed by Android: ").append(cells.size).append("\n")
            cells.take(10).forEachIndexed { index, cell ->
                report.append(index + 1).append(". ").append(cell.javaClass.simpleName)
                    .append(" • registered=").append(cell.isRegistered)
                    .append(" • ").append(cell.cellSignalStrength).append("\n")
            }
            if (cells.isEmpty()) report.append("No cell measurements returned. Location services or device permissions may limit readings.\n")
        } catch (e: Exception) {
            report.append("Cell readings unavailable: ").append(e.message ?: e.javaClass.simpleName).append("\n")
        }
        report.append("\nIMPORTANT: detecting radiation or a signal does not prove it carries internet data or provides a return path.")
        val result = report.toString()
        output.text = result
        recordExperiment("radio_scan", result)
    }

    private fun timestamp(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.US).format(Date())

    private fun recordExperiment(kind: String, details: String) {
        try {
            val entry = "\n--- " + timestamp() + " | " + kind + " ---\n" + details + "\n"
            openFileOutput("ambient-wave-experiments.txt", Context.MODE_APPEND).bufferedWriter().use { it.write(entry) }
        } catch (_: Exception) {
            runOnUiThread { output.text = output.text.toString() + "\nExperiment log could not be saved." }
        }
    }

    private fun exportExperimentLog() {
        try {
            val file = getFileStreamPath("ambient-wave-experiments.txt")
            if (!file.exists() || file.length() == 0L) {
                output.text = "No experiment records yet. Run a radio measurement or internet-route test first."
                return
            }
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "Ambient Wave Lab experiment log")
                putExtra(Intent.EXTRA_TEXT, file.readText())
            }
            startActivity(Intent.createChooser(share, "Export experiment log"))
        } catch (e: Exception) {
            output.text = "Could not export log: " + (e.message ?: e.javaClass.simpleName)
        }
    }

    private fun testInternet() {
        output.text = "Testing HTTPS reachability…"
        thread {
            val result = try {
                val started = System.currentTimeMillis()
                val connection = (URL("https://www.google.com/generate_204").openConnection() as HttpURLConnection).apply {
                    connectTimeout = 7000
                    readTimeout = 7000
                    requestMethod = "GET"
                    instanceFollowRedirects = false
                }
                val code = connection.responseCode
                connection.disconnect()
                val elapsed = System.currentTimeMillis() - started
                if (code == 204) "HTTPS test succeeded: server returned HTTP 204 in ${elapsed} ms. The phone already has a working internet route; this does not prove ambient-radiation conversion."
                else "HTTPS server responded with HTTP ${code} in ${elapsed} ms. Check captive portals or network restrictions."
            } catch (e: Exception) {
                "HTTPS test failed: ${e.message ?: e.javaClass.simpleName}. No successful route to this test endpoint was established."
            }
            recordExperiment("internet_route", result)
            runOnUiThread { output.text = result }
        }
    }
}
