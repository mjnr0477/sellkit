package com.sellkit.signallab

import android.app.Activity
import android.app.AlertDialog
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
            text = "Objective: establish whether a real internet resource is reachable without paid data. Signal bars or a successful HTTP request alone cannot prove that access is free."
            textSize = 16f
            setPadding(0, pad / 2, 0, pad)
        }
        report = TextView(this).apply { textSize = 15f; text = networkReport() }
        val refresh = Button(this).apply {
            text = "Refresh network status"
            setOnClickListener { report.text = networkReport() }
        }
        val test = Button(this).apply {
            text = "Test ordinary HTTPS connectivity"
            setOnClickListener { runProbe() }
        }
        val zeroRated = Button(this).apply {
            text = "Open Safaricom zero-rated learning resource"
            setOnClickListener {
                report.text = "Opening Internet of Good Things. Safaricom has described this resource as zero-rated, but current availability and charging must be verified on your SIM. Check balances before and after."
                openPage("https://ke.goodinternet.org/")
            }
        }
        val testIoGt = Button(this).apply {
            text = "Test IoGT endpoint (may use data)"
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Small internet test")
                    .setMessage("A small request will be sent to ke.goodinternet.org. If Safaricom does not zero-rate it on your SIM, it may consume paid data. Continue only if you accept this risk.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Test") { _, _ -> runIoGtProbe() }
                    .show()
            }
        }
        val opera = Button(this).apply {
            text = "Open Opera free-data information"
            setOnClickListener { openPage("https://help.opera.com/en/mini/android/") }
        }
        val wifi = Button(this).apply {
            text = "Find government public Wi-Fi"
            setOnClickListener { openPage("https://bilawaya.go.ke/") }
        }
        val offers = Button(this).apply {
            text = "Check Safaricom offers"
            setOnClickListener { openPage("https://myaccount.safaricom.co.ke/bundles?activeTab=1&monthlyBundles=true") }
        }
        val note = TextView(this).apply {
            text = "\nProof protocol:\n1. Check and record paid data and airtime balances through Safaricom.\n2. Open the zero-rated resource on the Safaricom SIM with Wi-Fi off.\n3. Navigate to a fresh page and confirm it actually loads.\n4. Recheck balances.\n5. Only claim free access if the resource loaded and no paid data or airtime was consumed.\n\nThis app cannot read Safaricom's billing records directly. A normal HTTPS success is not proof of zero-rating. Do not use video or download tests; they may consume paid data."
            textSize = 14f
        }
        layout.addView(title)
        layout.addView(intro)
        layout.addView(report)
        layout.addView(refresh)
        layout.addView(test)
        layout.addView(zeroRated)
        layout.addView(testIoGt)
        layout.addView(opera)
        layout.addView(wifi)
        layout.addView(offers)
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
        return "Active transport: " + transports.joinToString().ifEmpty { "Other/unknown" } +
            "\nAndroid internet capability: " + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) +
            "\nAndroid validated internet: " + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) +
            "\nAndroid reports unmetered: " + caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) +
            "\n\nThese Android flags do not establish whether Safaricom charges for access."
    }


    private fun runIoGtProbe() {
        report.text = networkReport() + "\n\nTesting IoGT endpoint…"
        executor.execute {
            val result = try {
                val connection = URL("https://ke.goodinternet.org/").openConnection() as HttpURLConnection
                connection.connectTimeout = 7000
                connection.readTimeout = 7000
                connection.instanceFollowRedirects = false
                connection.requestMethod = "GET"
                connection.setRequestProperty("Range", "bytes=0-1023")
                connection.setRequestProperty("User-Agent", "SellKit-Free-Access-Lab/1.0")
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
                    code in 200..299 -> "IoGT ENDPOINT REACHED: HTTP $code; read at most $bytes bytes. This proves endpoint reachability only, NOT free access. Check Safaricom data/airtime balances before and after."
                    code in 300..399 -> "IoGT returned redirect HTTP $code. Redirect not followed. Location: ${location ?: "not provided"}. Page access is not yet proven."
                    else -> "IoGT endpoint responded HTTP $code. Access not confirmed."
                }
            } catch (e: Exception) {
                "IoGT test FAILED: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}. This does not by itself prove that all internet access is unavailable."
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
                    if (code == 204) "HTTPS probe SUCCESS (HTTP 204). Internet endpoint reached. This does NOT prove free access; verify balances and the exact offer."
                    else "Endpoint returned HTTP $code. Check with a fresh page and verify whether paid data was used."
                }
            } catch (e: Exception) {
                "HTTPS probe FAILED: " + e.javaClass.simpleName + ": " + (e.message ?: "no detail") + ". This may indicate no data access, DNS failure, coverage, or endpoint blocking."
            }
            runOnUiThread { report.text = networkReport() + "\n\n" + result }
        }
    }

    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}
