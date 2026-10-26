package org.sellkit.ambientwave

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.os.Build
import android.os.Handler
import android.os.Looper
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
    private val mainHandler = Handler(Looper.getMainLooper())
    private var bleScanCallback: ScanCallback? = null
    private var bleScanner: BluetoothLeScanner? = null
    private var bleScanRunning = false
    private val bleObservations = linkedMapOf<String, String>()

    private fun requiredPermissions(): Array<String> {
        val permissions = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) permissions.add(Manifest.permission.BLUETOOTH_SCAN)
        return permissions.toTypedArray()
    }

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
        root.addView(actionButton("Scan Bluetooth LE broadcasts (10 seconds)") { scanBluetoothLe() })
        root.addView(actionButton("Test actual internet route") { testInternet() })
        root.addView(actionButton("Export experiment log") { exportExperimentLog() })
        root.addView(actionButton("Clear results") { output.text = "Results cleared. Choose a test." })
        root.addView(output)
        val scroll = ScrollView(this).apply { addView(root) }
        setContentView(scroll)
        val missing = requiredPermissions().filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), requestCode)
    }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        setOnClickListener { action() }
    }

    private fun measureSignals() {
        if (!permissionsGranted()) return
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


    private fun permissionsGranted(): Boolean {
        val missing = requiredPermissions().filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), requestCode)
            output.text = "Permission required. Grant it, then tap the test again."
            return false
        }
        return true
    }

    private fun scanBluetoothLe() {
        if (!permissionsGranted()) return
        if (bleScanRunning) {
            output.text = "Bluetooth LE scan is already running. Wait for it to finish."
            return
        }
        val manager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        val adapter: BluetoothAdapter? = manager.adapter
        if (adapter == null || !adapter.isEnabled) {
            output.text = "Bluetooth is unavailable or switched off. Turn Bluetooth on and retry."
            return
        }
        val scanner = adapter.bluetoothLeScanner
        if (scanner == null) {
            output.text = "This device does not expose a Bluetooth LE scanner right now."
            return
        }
        bleScanner = scanner
        bleObservations.clear()
        bleScanRunning = true
        output.text = "Scanning nearby Bluetooth LE advertisements for 10 seconds…"
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val record = result.scanRecord
                val name = record?.deviceName?.takeIf { it.isNotBlank() } ?: "(unnamed device)"
                val address = try { result.device.address ?: "address unavailable" } catch (_: SecurityException) { "address restricted" }
                val manufacturers = record?.manufacturerSpecificData
                val manufacturerSummary = if (manufacturers == null || manufacturers.size() == 0) "none"
                    else (0 until manufacturers.size()).joinToString { index ->
                        "id=0x%04X:%dB".format(Locale.US, manufacturers.keyAt(index), manufacturers.valueAt(index).size)
                    }
                val services = record?.serviceUuids?.joinToString { it.uuid.toString() } ?: "none"
                bleObservations[address] = name + " • " + address + " • RSSI " + result.rssi + " dBm • txPower " + result.txPower + " dBm • manufacturer data " + manufacturerSummary + " • service UUIDs " + services
                val preview = bleObservations.values.take(25).joinToString("\n")
                runOnUiThread { output.text = "Bluetooth LE scan running… " + bleObservations.size + " unique devices observed\n\n" + preview }
            }

            override fun onScanFailed(errorCode: Int) {
                runOnUiThread {
                    bleScanRunning = false
                    output.text = "Bluetooth LE scan failed with Android error code " + errorCode + "."
                    recordExperiment("ble_scan_error", "Android scan error code " + errorCode)
                }
            }
        }
        bleScanCallback = callback
        try {
            scanner.startScan(callback)
            mainHandler.postDelayed({ finishBluetoothLeScan() }, 10_000L)
        } catch (e: Exception) {
            bleScanRunning = false
            output.text = "Could not start Bluetooth LE scan: " + (e.message ?: e.javaClass.simpleName)
            recordExperiment("ble_scan_error", output.text.toString())
        }
    }

    private fun finishBluetoothLeScan() {
        if (!bleScanRunning) return
        try {
            val callback = bleScanCallback
            val scanner = bleScanner
            if (callback != null && scanner != null) scanner.stopScan(callback)
        } catch (_: Exception) { }
        bleScanRunning = false
        bleScanCallback = null
        bleScanner = null
        val report = buildString {
            append("BLUETOOTH LE BROADCAST SCAN (10 seconds)\n")
            append("Unique observed devices/broadcast addresses: ").append(bleObservations.size).append("\n\n")
            if (bleObservations.isEmpty()) append("No advertisements returned. Check Bluetooth, permissions, and nearby BLE activity.\n")
            else bleObservations.values.forEachIndexed { index, line -> append(index + 1).append(". ").append(line).append("\n") }
            append("\nThis is advertisement metadata exposed by Android, not arbitrary radio spectrum or guaranteed internet packets.")
        }
        output.text = report
        recordExperiment("ble_scan", report)
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

    override fun onDestroy() {
        finishBluetoothLeScan()
        super.onDestroy()
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
