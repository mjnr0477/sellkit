package com.sellkit.signallab

import android.app.Activity
import android.os.Bundle
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.graphics.Typeface
import android.net.Uri
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
            text = "SellKit Free Access Lab"
            textSize = 26f
            setTypeface(null, Typeface.BOLD)
        }
        val intro = TextView(this).apply {
            text = "Goal: find and verify a real internet connection without buying a data bundle. Investigate sponsored data and public Wi-Fi, then test real connectivity. Signal bars alone are not internet."
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
        val opera = Button(this).apply {
            text = "Investigate Opera Mini sponsored data"
            setOnClickListener { openPage("https://press.opera.com/2025/11/19/opera-mini-free-data-kenya/") }
        }
        val wifi = Button(this).apply {
            text = "Find government public Wi-Fi"
            setOnClickListener { openPage("https://bilawaya.go.ke/") }
        }
        val offers = Button(this).apply {
            text = "Check Safaricom offers"
            setOnClickListener { openPage("https://myaccount.safaricom.co.ke/bundles?activeTab=1&monthlyBundles=true") }
        }
        val thirdParty = Button(this).apply {
            text = "View data-reward service (third party)"
            setOnClickListener { openPage("https://freedata.co.ke/") }
        }
        val note = TextView(this).apply {
            text = "\nProof protocol:\n1. Record bundle and airtime balance before the test.\n2. Confirm a free/sponsored offer is actually activated or connect to public Wi-Fi.\n3. Load a fresh webpage and run the HTTPS probe.\n4. Check balances again through official Safaricom channels.\n5. Record success only if internet worked and paid data/airtime did not decrease.\n\nThe Opera/Safaricom campaign was announced in Nov 2025; current availability on your line must still be verified. Third-party reward services are not official Safaricom. Never share an M-PESA PIN."
            textSize = 14f
        }
        layout.addView(title)
        layout.addView(intro)
        layout.addView(report)
        layout.addView(refresh)
        layout.addView(test)
        layout.addView(opera)
        layout.addView(wifi)
        layout.addView(offers)
        layout.addView(thirdParty)
        layout.addView(note)
        setContentView(ScrollView(this).apply { addView(layout) })
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
        val internet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        val unmetered = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
        return "Active transport: " + transports.joinToString().ifEmpty { "Other/unknown" } +
            "\nAndroid internet capability: " + internet +
            "\nAndroid validated internet: " + validated +
            "\nAndroid reports unmetered: " + unmetered +
            "\n\nAndroid's unmetered flag does not prove Safaricom will not charge. Check bundle and airtime balances before and after testing."
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
                    if (code == 204) "HTTPS probe SUCCESS (HTTP 204). A real endpoint responded. This does NOT prove the connection was free; verify balances."
                    else "HTTPS endpoint responded with HTTP $code. Verify the result using a fresh webpage and balance checks."
                }
            } catch (e: Exception) {
                "HTTPS probe FAILED: " + e.javaClass.simpleName + ": " + (e.message ?: "no detail") + ". Failure may be caused by coverage, DNS, authentication, or no active data service."
            }
            runOnUiThread { report.text = networkReport() + "\n\n" + result }
        }
    }

    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}
