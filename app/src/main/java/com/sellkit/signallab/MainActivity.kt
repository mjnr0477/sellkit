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
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
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
            text = "Objective: test a real free-access resource inside this app over your Safaricom mobile connection. A successful load proves reachability; only carrier balance evidence can support a claim that it was free."
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
            text = "Open free-access resource INSIDE app"
            setOnClickListener {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val caps = network?.let { cm.getNetworkCapabilities(it) }
                if (caps == null || !caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("Switch to Safaricom mobile data")
                        .setMessage("Turn Wi-Fi off and make sure mobile data is using your Safaricom SIM. Then try again. This helps keep the test on the cellular connection.")
                        .setPositiveButton("OK", null).show()
                } else {
                    report.text = "Opening Internet of Good Things inside SellKit over the active cellular connection. If the page loads, record balances before and after to check whether your line was charged."
                    showResourceInApp()
                }
            }
        }
        val testIoGt = Button(this).apply {
            text = "Test Safaricom cellular endpoint"
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Small internet test")
                    .setMessage("Turn Wi-Fi OFF and use your Safaricom SIM. This sends a small request to ke.goodinternet.org through the active cellular network. It may consume paid data if not zero-rated on your line. Record your bundle balance first. Continue only if you accept this risk.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Test") { _, _ -> runIoGtProbe() }
                    .show()
            }
        }
        val opera = Button(this).apply {
            text = "Open Opera Mini information"
            setOnClickListener { openPage("https://www.opera.com/browsers/opera-mini") }
        }
        val wifi = Button(this).apply {
            text = "Find government public Wi-Fi"
            setOnClickListener { openPage("https://bilawaya.go.ke/") }
        }
        val offers = Button(this).apply {
            text = "Check Safaricom bundles"
            setOnClickListener { openPage("https://myaccount.safaricom.co.ke/bundles?activeTab=1&monthlyBundles=true") }
        }
        val note = TextView(this).apply {
            text = "\nProof protocol:\n1. Confirm mobile data is on the Safaricom SIM and Wi-Fi is off.\n2. Check and record bundle/airtime balances using Safaricom.\n3. Load and navigate the free-access resource inside this app.\n4. Recheck balances.\n5. Report only what the evidence supports.\n\nSellKit cannot read Safaricom billing records directly. A loaded page alone does not prove zero-rating. Do not test large downloads or video; they may consume paid data."
            textSize = 14f
        }
        layout.addView(title)
        layout.addView(intro)
        layout.addView(report)
        layout.addView(refresh)
        layout.addView(zeroRated)
        layout.addView(testIoGt)
        layout.addView(test)
        layout.addView(opera)
        layout.addView(wifi)
        layout.addView(offers)
        layout.addView(note)
        setContentView(ScrollView(this).apply { addView(layout) })
    }

    private fun showResourceInApp() {
        val webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    report.text = networkReport() + "\n\nIN-APP PAGE LOADED: ${url ?: "unknown URL"}. This confirms the resource rendered in SellKit, not that all internet is free. Compare your Safaricom balances."
                }
            }
            loadUrl("https://ke.goodinternet.org/")
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val back = Button(this).apply {
            text = "Back to test results"
            setOnClickListener {
                (webView.parent as? ViewGroup)?.removeView(webView)
                setContentView(ScrollView(this@MainActivity).apply {
                    addView((this@MainActivity.window.decorView.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as? ViewGroup))
                })
                recreate()
            }
        }
        container.addView(back)
        container.addView(webView, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        setContentView(container)
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
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val caps = network?.let { cm.getNetworkCapabilities(it) }
                if (network == null || caps == null || !caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    throw IllegalStateException("Cellular network is not active. Turn Wi-Fi off and ensure the Safaricom SIM has signal, then retry.")
                }
                val connection = network.openConnection(URL("https://ke.goodinternet.org/")) as HttpURLConnection
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
                    code in 200..299 -> "CELLULAR TEST: IoGT endpoint reached over Android's active cellular network (HTTP $code); read at most $bytes bytes. This proves cellular reachability only, NOT free access or long-distance Wi-Fi. Compare Safaricom bundle/airtime balance before and after."
                    code in 300..399 -> "IoGT returned redirect HTTP $code. Redirect not followed. Location: ${location ?: "not provided"}. Page access is not yet proven."
                    else -> "IoGT endpoint responded HTTP $code. Access not confirmed."
                }
            } catch (e: Exception) {
                "CELLULAR TEST FAILED: ${e.javaClass.simpleName}: ${e.message ?: "no detail"}. No fallback to Wi-Fi is attempted. This does not by itself prove that free access is unavailable."
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