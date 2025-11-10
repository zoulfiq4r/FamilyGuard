package com.familyguardnew.blocker

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class FamilyGuardDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onEnabled(context: Context, intent: Intent) {
    super.onEnabled(context, intent)
    Log.i(TAG, "Device admin enabled")
  }

  override fun onDisabled(context: Context, intent: Intent) {
    super.onDisabled(context, intent)
    Log.i(TAG, "Device admin disabled")
  }

  companion object {
    private const val TAG = "FGDeviceAdmin"
  }
}
