plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.sellkit.signallab"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.sellkit.signallab"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
}
kotlin { jvmToolchain(17) }
