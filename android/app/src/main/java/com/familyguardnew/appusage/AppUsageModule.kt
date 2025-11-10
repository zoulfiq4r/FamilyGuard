package com.familyguardnew.appusage

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

class AppUsageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppUsageModule"

  @ReactMethod
  fun hasUsageAccessPermission(promise: Promise) {
    try {
      val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactContext.packageName,
          )
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactContext.packageName,
          )
        }
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (error: Throwable) {
      promise.reject("usage_permission_error", error)
    }
  }

  @ReactMethod
  fun openUsageAccessSettings() {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun getUsageEvents(since: Double, promise: Promise) {
    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
          ?: throw IllegalStateException("UsageStatsManager unavailable")

      val startTime = since.toLong()
      val endTime = System.currentTimeMillis()
      val usageEvents = usageStatsManager.queryEvents(startTime, endTime)
      val eventsArray = Arguments.createArray()
      val packageManager = reactContext.packageManager
      val reusableEvent = UsageEvents.Event()

      while (usageEvents.hasNextEvent()) {
        usageEvents.getNextEvent(reusableEvent)
        if (
          reusableEvent.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
          reusableEvent.eventType == UsageEvents.Event.MOVE_TO_BACKGROUND
        ) {
          val map = Arguments.createMap()
          val packageName = reusableEvent.packageName ?: continue
          map.putString("packageName", packageName)
          map.putString("appName", resolveAppName(packageManager, packageName))
          map.putString(
            "eventType",
            if (reusableEvent.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
              "FOREGROUND"
            } else {
              "BACKGROUND"
            },
          )
          map.putDouble("timestamp", reusableEvent.timeStamp.toDouble())
          reusableEvent.className?.let { map.putString("className", it) }
          eventsArray.pushMap(map)
        }
      }

      promise.resolve(eventsArray)
    } catch (error: Throwable) {
      promise.reject("usage_events_error", error)
    }
  }

  @ReactMethod
  fun getUsageSummary(startTimeDouble: Double, endTimeDouble: Double, promise: Promise) {
    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
          ?: throw IllegalStateException("UsageStatsManager unavailable")

      val startTime = startTimeDouble.toLong()
      val endTime = endTimeDouble.toLong()
      val statsList: List<UsageStats> =
        usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
          ?: emptyList()

      val resultArray = Arguments.createArray()
      val packageManager = reactContext.packageManager

      statsList
        .filter { it.totalTimeInForeground > 0 }
        .sortedByDescending { it.totalTimeInForeground }
        .forEach { stats ->
          val map = Arguments.createMap()
          val packageName = stats.packageName ?: return@forEach
          map.putString("packageName", packageName)
          map.putString("appName", resolveAppName(packageManager, packageName))
          map.putDouble("totalForegroundMs", stats.totalTimeInForeground.toDouble())
          map.putDouble("lastTimeUsed", stats.lastTimeUsed.toDouble())
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            map.putDouble("totalTimeVisibleMs", stats.totalTimeVisible.toDouble())
          }
          resultArray.pushMap(map)
        }

      promise.resolve(resultArray)
    } catch (error: Throwable) {
      promise.reject("usage_summary_error", error)
    }
  }

  @ReactMethod
  fun getCurrentForegroundApp(promise: Promise) {
    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
          ?: throw IllegalStateException("UsageStatsManager unavailable")

      val endTime = System.currentTimeMillis()
      val startTime = endTime - TimeUnit.MINUTES.toMillis(5) // inspect last 5 minutes
      val events = usageStatsManager.queryEvents(startTime, endTime)
      val packageManager = reactContext.packageManager
      val reusableEvent = UsageEvents.Event()
      var currentPackage: String? = null
      var currentClass: String? = null
      var lastTimestamp = 0L

      while (events.hasNextEvent()) {
        events.getNextEvent(reusableEvent)
        val packageName = reusableEvent.packageName ?: continue
        when (reusableEvent.eventType) {
          UsageEvents.Event.MOVE_TO_FOREGROUND -> {
            currentPackage = packageName
            currentClass = reusableEvent.className
            lastTimestamp = reusableEvent.timeStamp
          }
          UsageEvents.Event.MOVE_TO_BACKGROUND -> {
            if (currentPackage == packageName && reusableEvent.timeStamp >= lastTimestamp) {
              currentPackage = null
              currentClass = null
              lastTimestamp = reusableEvent.timeStamp
            }
          }
        }
      }

      if (currentPackage == null) {
        promise.resolve(null)
        return
      }

      val map = Arguments.createMap()
      map.putString("packageName", currentPackage)
      map.putString("appName", resolveAppName(packageManager, currentPackage!!))
      currentClass?.let { map.putString("className", it) }
      map.putDouble("since", lastTimestamp.toDouble())
      map.putDouble("queriedAt", endTime.toDouble())

      promise.resolve(map)
    } catch (error: Throwable) {
      promise.reject("foreground_app_error", error)
    }
  }

  private fun resolveAppName(packageManager: android.content.pm.PackageManager, packageName: String): String =
    try {
      val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(applicationInfo).toString()
    } catch (_: Throwable) {
      packageName
    }
}
