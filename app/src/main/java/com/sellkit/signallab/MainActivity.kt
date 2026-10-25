package com.sellkit.signallab

import android.app.Activity
import android.os.Bundle
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.graphics.Typeface
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (resources.displayMetrics.density * 20).toInt()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            gravity = Gravity.TOP
        }
        val title = TextView(this).apply {
            text = "SellKit Signal Lab"
            textSize = 26f
            setTypeface(null, Typeface.BOLD)
        }
        val intro = TextView(this).apply {
            text = "Experiment: does this phone have a real mobile-data path? Signal bars alone are not internet. Turn Wi-Fi off for a cellular-only test."
            textSize = 16f
            setPadding(0, pad / 2, 0, pad)
        }
        report = TextView(this).apply { textSize = 15f; text = networkReport() }
        val refresh = Button(this).apply {
            text = "Refresh network status"
            setOnClickListener { report.text = networkReport() }
        }
        val test = Button(this).apply {
            text = "Test real HTTPS connection"
            setOnClickListener { runProbe() }
        }
        val note = TextView(this).apply {
            text = "\nInterpretation: success proves only that this endpoint was reachable at test time. It does not prove data is free or reveal why the carrier allowed it. Do not use cached pages as evidence."
            textSize = 14f
        }
        layout.addView(title)
        layout.addView(intro)
        layout.addView(report)
        layout.addView(refresh)
        layout.addView(test)
        layout.addView(note)
        setContentView(ScrollView(this).apply { addView(layout) })
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
        val internet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        val unmetered = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
        return "Active transport: " + transports.joinToString().ifEmpty { "Other/unknown" } +
            "\nAndroid internet capability: " + internet +
            "\nAndroid validated internet: " + validated +
            "\nAndroid reports unmetered: " + unmetered +
            "\n\nNote: these are Android network indicators, not proof that Safaricom data is free."
    }

    private fun runProbe() {
        report.text = networkReport() + "\n\nHTTPS test running…"
        executor.execute {
            val result = try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val caps = network?.let { cm.getNetworkCapabilities(it) }
                if (caps == null || !caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    "Test not run: active network is not cellular. Turn Wi-Fi off and refresh, then retry."
                } else {
                    val connection = URL("https://connectivitycheck.gstatic.com/generate_204").openConnection() as HttpURLConnection
                    connection.connectTimeout = 8000
                    connection.readTimeout = 8000
                    connection.instanceFollowRedirects = false
                    connection.requestMethod = "GET"
                    connection.connect()
                    val code = connection.responseCode
                    connection.disconnect()
                    if (code == 204) "HTTPS probe SUCCESS (HTTP 204). A real endpoint responded over the phone's active network. This alone does not establish whether the carrier charged data or supplied a promotion."
                    else "HTTPS endpoint responded with HTTP " + code + ". Connection reached a server, but response differed from expected 204."
                }
            } catch (e: Exception) {
                "HTTPS probe FAILED: " + e.javaClass.simpleName + ": " + (e.message ?: "no detail") + ". Repeat the test; failure may be caused by coverage, DNS, endpoint blocking, or no data service."
            }
            runOnUiThread { report.text = networkReport() + "\n\n" + result }
        }
    }

    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}
