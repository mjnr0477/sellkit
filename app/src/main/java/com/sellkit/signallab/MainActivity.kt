package com.sellkit.signallab

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Network
import android.net.NetworkRequest
import android.net.Uri
import android.net.wifi.WifiManager
import android.telephony.TelephonyManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var report: TextView
    private val executor = Executors.newSingleThreadExecutor()
    private val scanPermissionRequest = 410
    private val phoneStatePermissionRequest = 411
    private val scanPermissions: Array<String>
        get() = if (Build.VERSION.SDK_INT >= 33)
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.NEARBY_WIFI_DEVICES)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (resources.displayMetrics.density * 20).toInt()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            gravity = Gravity.TOP
        }
        val title = TextView(this).apply {
            text = "SellKit Signal-to-Internet Lab"
            textSize = 26f
            setTypeface(null, Typeface.BOLD)
        }
        val intro = TextView(this).apply {
            text = "Scan nearby Wi-Fi signals, compare signal strength, and test whether an internet endpoint is reachable. A strong signal is not proof that a network has internet or that access is free."
            textSize = 16f
            setPadding(0, pad / 2, 0, pad)
        }
        report = TextView(this).apply { textSize = 15f; text = networkReport() }
        val scan = Button(this).apply {
            text = "Scan nearby Wi-Fi signals"
            setOnClickListener { requestScanPermissionAndScan() }
        }
        val cellular = Button(this).apply {
            text = "Measure cellular signal and registration"
            setOnClickListener { requestCellularStatus() }
        }
        val refresh = Button(this).apply {
            text = "Refresh connected network status"
            setOnClickListener { report.text = networkReport() }
        }
        val test = Button(this).apply {
            text = "Test ordinary HTTPS connectivity"
            setOnClickListener { runProbe() }
        }
        val cellularTest = Button(this).apply {
            text = "Test mobile-data path only (may use data)"
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Cellular-only internet test")
                    .setMessage("Android will request a cellular network and send a small HTTPS request through it, even if Wi-Fi is connected. This may use paid mobile data. Continue only if you accept the risk.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Test") { _, _ -> runCellularProbe() }
                    .show()
            }
        }
        val zeroRated = Button(this).apply {
            text = "Open Safaricom learning resource"
            setOnClickListener {
                report.text = "Opening Internet of Good Things. Whether it is zero-rated now depends on Safaricom's current service and your SIM. Verify balances before and after."
                openPage("https://ke.goodinternet.org/")
            }
        }
        val testIoGt = Button(this).apply {
            text = "Test learning endpoint (may use data)"
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Small internet test")
                    .setMessage("A small request will be sent to ke.goodinternet.org. It may consume paid data. Continue only if you accept this risk.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Test") { _, _ -> runIoGtProbe() }
                    .show()
            }
        }
        val wifi = Button(this).apply {
            text = "Find public Wi-Fi information"
            setOnClickListener { openPage("https://bilawaya.go.ke/") }
        }
        val offers = Button(this).apply {
            text = "Check Safaricom offers"
            setOnClickListener { openPage("https://myaccount.safaricom.co.ke/bundles?activeTab=1&monthlyBundles=true") }
        }
        val note = TextView(this).apply {
            text = "\nSignal scan notes:\n• Android may require location services to be enabled for Wi-Fi scan results.\n• Android limits how frequently apps can scan; results may be cached or incomplete.\n• This scan only lists visible Wi-Fi access points. It does not connect to protected networks, bypass passwords, or convert radio signal into internet service.\n• Internet access must come from an authorized Wi-Fi network, mobile-data service, or a provider that grants access.\n\nA successful HTTPS request proves endpoint reachability only, not free access. Verify billing with your network provider."
            textSize = 14f
        }
        layout.addView(title)
        layout.addView(intro)
        layout.addView(report)
        layout.addView(scan)
        layout.addView(cellular)
        layout.addView(refresh)
        layout.addView(test)
        layout.addView(cellularTest)
        layout.addView(zeroRated)
        layout.addView(testIoGt)
        layout.addView(wifi)
        layout.addView(offers)
        layout.addView(note)
        setContentView(ScrollView(this).apply { addView(layout) })
    }

    private fun requestCellularStatus() {
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.READ_PHONE_STATE), phoneStatePermissionRequest)
            return
        }
        report.text = networkReport() + "\n\n" + cellularReport()
    }

    @Suppress("DEPRECATION")
    private fun cellularReport(): String {
        return try {
            val tm = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val networkType = when (tm.dataNetworkType) {
                TelephonyManager.NETWORK_TYPE_NR -> "5G NR"
                TelephonyManager.NETWORK_TYPE_LTE -> "4G LTE"
                TelephonyManager.NETWORK_TYPE_HSPAP, TelephonyManager.NETWORK_TYPE_HSPA,
                TelephonyManager.NETWORK_TYPE_HSDPA, TelephonyManager.NETWORK_TYPE_HSUPA -> "3G HSPA"
                TelephonyManager.NETWORK_TYPE_UMTS -> "3G UMTS"
                TelephonyManager.NETWORK_TYPE_EDGE -> "2G EDGE"
                TelephonyManager.NETWORK_TYPE_GPRS -> "2G GPRS"
                TelephonyManager.NETWORK_TYPE_GSM -> "2G GSM"
                TelephonyManager.NETWORK_TYPE_UNKNOWN -> "Unknown / not registered for mobile data"
                else -> "Other (${tm.dataNetworkType})"
            }
            val signal = tm.signalStrength
            val strength = signal?.let { "Signal level: ${it.level}/4; dBm: ${it.cellSignalStrengths.firstOrNull()?.dbm ?: "unavailable"}" }
                ?: "Signal strength unavailable (SIM, radio state, or Android restriction)."
            val dataEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) tm.isDataEnabled else null
            "Cellular radio diagnostics\nMobile data network type: $networkType\nMobile data enabled: ${dataEnabled ?: "not exposed on this Android version"}\n$strength\n\nImportant: radio signal bars only measure the phone-to-tower link. They do not create an internet connection or provide carrier authorization. A working path still requires registered cellular service and data access from the operator."
        } catch (e: SecurityException) {
            "Android denied phone-state access. Grant Phone state permission and retry."
        } catch (e: Exception) {
            "Cellular diagnostics unavailable: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}"
        }
    }
    private fun requestScanPermissionAndScan() {
        val missing = scanPermissions.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), scanPermissionRequest)
            return
        }
        scanNearbyWifi()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == phoneStatePermissionRequest) {
            report.text = if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) networkReport() + "\n\n" + cellularReport() else "Phone state permission was not granted; cellular signal details are unavailable."
            return
        }
        if (requestCode == scanPermissionRequest) {
            if (scanPermissions.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) {
                scanNearbyWifi()
            } else {
                report.text = "Wi-Fi scan needs Location permission for scan results and Nearby Wi-Fi permission on Android 13+. Grant both and try again."
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun scanNearbyWifi() {
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        if (!wifi.isWifiEnabled) {
            report.text = "Wi-Fi is turned off. Turn on Wi-Fi in Android settings, then scan again. This app will not enable it silently."
            return
        }
        report.text = "Scanning nearby Wi-Fi networks… Android may return cached results or limit scan frequency."
        executor.execute {
            try {
                val scanStarted = wifi.startScan()
                // Do not immediately read scanResults: Android may still be returning an older scan.
                val results = wifi.scanResults
                    .sortedByDescending { it.level }
                    .distinctBy { it.BSSID }
                val text = if (results.isEmpty()) {
                    "No scan results returned. Fresh scan request accepted: $scanStarted. Enable Android Location services if required, grant scan permission, and try again later."
                } else {
                    val lines = results.take(30).mapIndexed { index, ap ->
                        val strength = when {
                            ap.level >= -50 -> "Excellent"
                            ap.level >= -60 -> "Strong"
                            ap.level >= -70 -> "Fair"
                            ap.level >= -80 -> "Weak"
                            else -> "Very weak"
                        }
                        val protected = ap.capabilities.contains("WPA", ignoreCase = true) ||
                            ap.capabilities.contains("WEP", ignoreCase = true) ||
                            ap.capabilities.contains("SAE", ignoreCase = true) ||
                            ap.capabilities.contains("EAP", ignoreCase = true)
                        "${index + 1}. ${ap.SSID.ifBlank { "(hidden network)" }}\n   Signal: ${ap.level} dBm ($strength) · Frequency: ${ap.frequency} MHz · Security: ${if (protected) "Protected" else "Possibly open"}"
                    }
                    "Nearby Wi-Fi access points: ${results.size} (showing up to 30)\nFresh scan request accepted: $scanStarted (results may still be cached)\n\n" + lines.joinToString("\n\n") +
                        "\n\nSignal strength only. This list does not confirm internet access or authorize joining any network."
                }
                runOnUiThread { report.text = networkReport() + "\n\n" + text }
            } catch (e: SecurityException) {
                runOnUiThread { report.text = "Wi-Fi scan blocked by Android permission: ${e.message ?: "permission required"}" }
            } catch (e: Exception) {
                runOnUiThread { report.text = "Wi-Fi scan failed: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}" }
            }
        }
    }

    private fun openPage(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            report.text = "Could not open browser. Address: $url"
        }
    }

    private fun networkReport(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return "Active network: none\n\nNo active network is reported by Android."
        val caps = cm.getNetworkCapabilities(network)
            ?: return "Active network found, but capabilities are unavailable."
        val transports = mutableListOf<String>()
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) transports.add("Cellular")
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) transports.add("Wi-Fi")
        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) transports.add("Ethernet")
        return "Active transport: " + transports.joinToString().ifEmpty { "Other/unknown" } +
            "\nAndroid internet capability: " + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) +
            "\nAndroid validated internet: " + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) +
            "\nAndroid reports unmetered: " + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) +
            "\n\nThese Android flags do not establish whether Safaricom charges for access."
    }

    private fun runCellularProbe() {
        report.text = networkReport() + "\n\nRequesting cellular network for a mobile-data-only test…"
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val finished = java.util.concurrent.atomic.AtomicBoolean(false)
        val timeout = android.os.Handler(mainLooper)
        lateinit var callback: ConnectivityManager.NetworkCallback
        callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                if (!finished.compareAndSet(false, true)) return
                timeout.removeCallbacksAndMessages(null)
                executor.execute {
                    val result = try {
                        val connection = network.openConnection(URL("https://connectivitycheck.gstatic.com/generate_204")) as HttpURLConnection
                        connection.connectTimeout = 8000
                        connection.readTimeout = 8000
                        connection.instanceFollowRedirects = false
                        connection.requestMethod = "GET"
                        connection.connect()
                        val code = connection.responseCode
                        connection.disconnect()
                        if (code == 204) "Cellular-only HTTPS probe succeeded (HTTP 204). Mobile data can reach this endpoint; this does not mean access is free." else "Cellular-only endpoint returned HTTP $code. Internet access was not confirmed."
                    } catch (e: Exception) {
                        "Cellular-only HTTPS probe failed: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}."
                    }
                    runOnUiThread {
                        report.text = networkReport() + "\n\n" + result
                        try { cm.unregisterNetworkCallback(callback) } catch (_: Exception) { }
                    }
                }
            }
            override fun onUnavailable() {
                if (!finished.compareAndSet(false, true)) return
                timeout.removeCallbacksAndMessages(null)
                try { cm.unregisterNetworkCallback(callback) } catch (_: Exception) { }
                runOnUiThread { report.text = networkReport() + "\n\nAndroid could not provide a cellular network for this test. Check SIM registration, mobile data, coverage, and carrier restrictions." }
            }
        }
        timeout.postDelayed({
            if (finished.compareAndSet(false, true)) {
                try { cm.unregisterNetworkCallback(callback) } catch (_: Exception) { }
                report.text = networkReport() + "\n\nTimed out waiting for a cellular network. No conclusion about signal strength can be drawn from this timeout alone."
            }
        }, 20000)
        try {
            cm.requestNetwork(request, callback, 20000)
        } catch (e: Exception) {
            timeout.removeCallbacksAndMessages(null)
            report.text = networkReport() + "\n\nCould not request cellular network: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}"
        }
    }
    private fun runIoGtProbe() {
        report.text = networkReport() + "\n\nTesting learning endpoint…"
        executor.execute {
            val result = try {
                val connection = URL("https://ke.goodinternet.org/").openConnection() as HttpURLConnection
                connection.connectTimeout = 7000
                connection.readTimeout = 7000
                connection.instanceFollowRedirects = false
                connection.requestMethod = "GET"
                connection.setRequestProperty("Range", "bytes=0-1023")
                connection.setRequestProperty("User-Agent", "SellKit-Signal-Lab/1.0")
                connection.connect()
                val code = connection.responseCode
                val location = connection.getHeaderField("Location")
                var bytes = 0
                if (code in 200..299) {
                    val stream = connection.inputStream
                    val buffer = ByteArray(512)
                    while (bytes < 2048) {
                        val n = stream.read(buffer, 0, minOf(buffer.size, 2048 - bytes))
                        if (n <= 0) break
                        bytes += n
                    }
                    stream.close()
                }
                connection.disconnect()
                when {
                    code in 200..299 -> "Endpoint reached: HTTP $code; read at most $bytes bytes. This proves reachability only, NOT free access. Check provider balances."
                    code in 300..399 -> "Endpoint returned redirect HTTP $code. Redirect not followed. Location: ${location ?: "not provided"}."
                    else -> "Endpoint responded HTTP $code. Access not confirmed."
                }
            } catch (e: Exception) {
                "Endpoint test failed: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}."
            }
            runOnUiThread { report.text = networkReport() + "\n\n" + result }
        }
    }

    private fun runProbe() {
        report.text = networkReport() + "\n\nHTTPS test running…"
        executor.execute {
            val result = try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val caps = network?.let { cm.getNetworkCapabilities(it) }
                if (caps == null || (!caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) &&
                        !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))) {
                    "Test not run: active network is not cellular or Wi-Fi."
                } else {
                    val connection = URL("https://connectivitycheck.gstatic.com/generate_204").openConnection() as HttpURLConnection
                    connection.connectTimeout = 8000
                    connection.readTimeout = 8000
                    connection.instanceFollowRedirects = false
                    connection.requestMethod = "GET"
                    connection.connect()
                    val code = connection.responseCode
                    connection.disconnect()
                    if (code == 204) "HTTPS probe succeeded (HTTP 204). Endpoint reached; this does NOT prove free access."
                    else "Endpoint returned HTTP $code. Check on a fresh page and verify whether paid data was used."
                }
            } catch (e: Exception) {
                "HTTPS probe failed: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}."
            }
            runOnUiThread { report.text = networkReport() + "\n\n" + result }
        }
    }

    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}
