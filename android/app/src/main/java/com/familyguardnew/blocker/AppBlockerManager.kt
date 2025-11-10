package com.familyguardnew.blocker

import android.content.Context
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap

data class BlockRule(
  val packageName: String,
  val reason: String,
  val message: String,
)

data class BlockRules(
  val blockedPackages: Map<String, BlockRule>,
  val globalRule: BlockRule?,
)

object AppBlockerManager {
  private val lock = Any()
  private var rules: BlockRules = BlockRules(emptyMap(), null)
  private var serviceRef: WeakReference<AppBlockerAccessibilityService?> =
    WeakReference(null)

  fun registerService(service: AppBlockerAccessibilityService) {
    synchronized(lock) {
      serviceRef = WeakReference(service)
    }
  }

  fun unregisterService(service: AppBlockerAccessibilityService) {
    synchronized(lock) {
      val current = serviceRef.get()
      if (current == service) {
        serviceRef = WeakReference(null)
      }
    }
  }

  fun updateRules(newRules: BlockRules) {
    synchronized(lock) {
      rules = newRules
    }
    serviceRef.get()?.handleRulesUpdated()
  }

  fun currentRules(): BlockRules =
    synchronized(lock) {
      rules
    }

  fun resolve(packageName: String?): BlockRule? {
    if (packageName.isNullOrEmpty()) {
      return null
    }
    val snapshot = currentRules()
    val directRule = snapshot.blockedPackages[packageName]
    return directRule ?: snapshot.globalRule
  }

  fun clear(context: Context) {
    updateRules(BlockRules(emptyMap(), null))
  }
}
