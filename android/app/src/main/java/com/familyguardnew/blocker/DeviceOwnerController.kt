package com.familyguardnew.blocker

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log

object DeviceOwnerController {
  private const val TAG = "DeviceOwnerController"
  private val lock = Any()
  private var enforcedPackages: Set<String> = emptySet()

  fun updateBlockedPackages(context: Context, packageNames: Set<String>): Boolean {
    val dpm = context.getSystemService(DevicePolicyManager::class.java) ?: return false
    val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)
    if (!isDeviceOwner) {
      clearInternal(dpm, context)
      return false
    }

    val sanitized = packageNames.filter { packageName ->
      packageName.isNotBlank() &&
        packageName != context.packageName &&
        packageName != "*"
    }.toSet()

    val componentName = ComponentName(context, FamilyGuardDeviceAdminReceiver::class.java)

    synchronized(lock) {
      val previous = enforcedPackages
      val toSuspend = sanitized.minus(previous)
      val toUnsuspend = previous.minus(sanitized)

      if (toSuspend.isNotEmpty()) {
        applySuspension(dpm, componentName, toSuspend, true)
      }

      if (toUnsuspend.isNotEmpty()) {
        applySuspension(dpm, componentName, toUnsuspend, false)
      }

      enforcedPackages = sanitized
    }

    return true
  }

  fun hasDeviceOwnerPrivileges(context: Context): Boolean {
    val dpm = context.getSystemService(DevicePolicyManager::class.java)
    return dpm?.isDeviceOwnerApp(context.packageName) ?: false
  }

  private fun applySuspension(
    dpm: DevicePolicyManager,
    componentName: ComponentName,
    packageNames: Set<String>,
    suspend: Boolean,
  ) {
    if (packageNames.isEmpty()) {
      return
    }

    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        dpm.setPackagesSuspended(componentName, packageNames.toTypedArray(), suspend)
      } else {
        packageNames.forEach { packageName ->
          @Suppress("DEPRECATION")
          dpm.setApplicationHidden(componentName, packageName, suspend)
        }
      }
    }.onFailure { error ->
      Log.e(TAG, "Failed to update package suspension", error)
    }
  }

  private fun clearInternal(dpm: DevicePolicyManager, context: Context) {
    val componentName = ComponentName(context, FamilyGuardDeviceAdminReceiver::class.java)
    val snapshot: Set<String>
    synchronized(lock) {
      if (enforcedPackages.isEmpty()) {
        return
      }
      snapshot = enforcedPackages
      enforcedPackages = emptySet()
    }
    applySuspension(dpm, componentName, snapshot, false)
  }
}
