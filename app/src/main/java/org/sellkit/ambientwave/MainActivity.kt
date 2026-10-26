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
import android.os.BatteryManager
import android.hardware.usb.UsbManager
import android.net.Network
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
        root.addView(actionButton("Test USB, TV connection & charging") { testUsbAndPower() })
        root.addView(actionButton("Test actual internet route") { testInternet() })
        root.addView(actionButton("Discover & test usable internet sources") { discoverInternetSources() })
        root.addView(actionButton("Measure ambient EM observations") { measureSignals() })
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

    private fun testUsbAndPower() {
        val report = buildString {
            append("USB AND POWER EXPERIMENT\\n\\n")
            try {
                val batteryIntent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                if (batteryIntent == null) {
                    append("Battery/charging broadcast unavailable.\\n")
                } else {
                    val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                    val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                    val percent = if (level >= 0 && scale > 0) (level * 100) / scale else -1
                    val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                    val plugged = batteryIntent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
                    val statusText = when (status) {
                        BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
                        BatteryManager.BATTERY_STATUS_FULL -> "full"
                        BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
                        BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not charging"
                        else -> "unknown"
                    }
                    val source = when {
                        plugged and BatteryManager.BATTERY_PLUGGED_USB != 0 -> "USB power"
                        plugged and BatteryManager.BATTERY_PLUGGED_AC != 0 -> "AC/wall charger"
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 &&
                            plugged and BatteryManager.BATTERY_PLUGGED_WIRELESS != 0 -> "wireless charging"
                        plugged == 0 -> "no external power reported"
                        else -> "other/unknown power source (code $plugged)"
                    }
                    append("Battery level: ").append(if (percent >= 0) "$percent%" else "unavailable").append("\\n")
                    append("Battery status: ").append(statusText).append("\\n")
                    append("Power source reported by Android: ").append(source).append("\\n")
                }
            } catch (e: Exception) {
                append("Battery status unavailable: ").append(e.message ?: e.javaClass.simpleName).append("\\n")
            }
            try {
                val usb = getSystemService(Context.USB_SERVICE) as UsbManager
                val devices = usb.deviceList.values
                append("\\nUSB host devices visible to Android: ").append(devices.size).append("\\n")
                if (devices.isEmpty()) {
                    append("No USB devices exposed in host mode. A TV connected as USB host may not appear here; this alone does not mean the cable is faulty.\\n")
                } else {
                    devices.take(20).forEachIndexed { index, device ->
                        append(index + 1).append(". ").append(device.deviceName)
                            .append(" • vendorId=").append(device.vendorId)
                            .append(" • productId=").append(device.productId)
                            .append(" • interfaces=").append(device.interfaceCount).append("\\n")
                    }
                }
            } catch (e: Exception) {
                append("USB device listing unavailable: ").append(e.message ?: e.javaClass.simpleName).append("\\n")
            }
            try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val caps = if (network != null) cm.getNetworkCapabilities(network) else null
                append("\\nACTIVE NETWORK (Android-reported)\\n")
                if (caps == null) append("No active network capabilities reported.\\n")
                else {
                    val transports = mutableListOf<String>()
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) transports.add("Wi-Fi")
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) transports.add("cellular")
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) transports.add("Ethernet")
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)) transports.add("Bluetooth")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI_AWARE)) transports.add("Wi-Fi Aware")
                    append("Transport(s): ").append(transports.joinToString().ifBlank { "other/unknown" }).append("\\n")
                    append("Android reports internet capability: ").append(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)).append("\\n")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) append("Android reports validated internet: ").append(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)).append("\\n")
                }
            } catch (e: Exception) {
                append("Network state unavailable: ").append(e.message ?: e.javaClass.simpleName).append("\\n")
            }
            append("\\nSAFETY / INTERPRETATION\\n")
            append("This test reads Android-exposed charging, USB-host and network metadata. It cannot measure mains voltage or decode arbitrary electrical signals. Do not connect exposed wires or modify a charger. A TV USB port or charger does not inherently provide internet.")
        }
        output.text = report
        recordExperiment("usb_power_scan", report)
    }


    // Internet source discovery checks Android's active route; it does not claim RF-to-internet conversion.\n    private fun discoverInternetSources() {
        output.text = "Checking Android's active network and testing real HTTPS routes…"
        thread {
            val report = StringBuilder("INTERNET SOURCE DISCOVERY & CONNECTIVITY TEST\\n\\n")
            try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val caps = if (network != null) cm.getNetworkCapabilities(network) else null
                if (caps == null) report.append("Active network: none reported by Android.\\n")
                else {
                    val transports = mutableListOf<String>()
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) transports.add("Wi-Fi")
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) transports.add("cellular")
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) transports.add("Ethernet")
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)) transports.add("Bluetooth")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI_AWARE)) transports.add("Wi-Fi Aware")
                    report.append("Android active transport: ").append(transports.joinToString().ifBlank { "other/unknown" }).append("\\n")
                    report.append("Network claims internet capability: ").append(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)).append("\\n")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) report.append("Android validated internet: ").append(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)).append("\\n")
                }
            } catch (e: Exception) {
                report.append("Network metadata unavailable: ").append(e.message ?: e.javaClass.simpleName).append("\\n")
            }
            report.append("\\nREAL HTTPS ENDPOINT TESTS\\n")
            val endpoints = listOf(
                "Google connectivity check" to "https://www.google.com/generate_204",
                "Cloudflare trace" to "https://www.cloudflare.com/cdn-cgi/trace",
                "Android connectivity check" to "https://connectivitycheck.gstatic.com/generate_204"
            )
            var successes = 0
            for ((name, address) in endpoints) {
                val result = try {
                    val started = System.currentTimeMillis()
                    val conn = (URL(address).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 5000
                        readTimeout = 5000
                        requestMethod = "GET"
                        instanceFollowRedirects = false
                    }
                    val code = conn.responseCode
                    conn.disconnect()
                    val ms = System.currentTimeMillis() - started
                    if (code in 200..399) successes++
                    "$name: HTTP $code in ${ms} ms"
                } catch (e: Exception) {
                    "$name: failed (${e.message ?: e.javaClass.simpleName})"
                }
                report.append(result).append("\\n")
            }
            report.append("\\nRESULT: ").append(successes).append("/").append(endpoints.size)
                .append(" endpoints reachable. This tests the phone's current Android network route, not every nearby Wi-Fi network or a distant source. A nearby access point is not proven to have internet until the phone can actually connect to it.\\n")
            report.append("LIMIT: Without a network connection, a remote registry, or a compatible transmitting source, the phone cannot discover internet sources kilometres away. Built-in radios expose only supported Wi-Fi/Bluetooth/cellular metadata; they are not a general-purpose spectrum analyzer.")
            val result = report.toString()
            recordExperiment("internet_source_discovery", result)
            runOnUiThread { output.text = result }
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
