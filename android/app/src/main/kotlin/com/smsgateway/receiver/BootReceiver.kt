package com.smsgateway.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.smsgateway.data.local.SessionManager
import com.smsgateway.service.GatewayForegroundService
import dagger.hilt.android.AndroidEntryPoint
import timber.log.Timber
import javax.inject.Inject

/**
 * Starts the gateway automatically after device reboot.
 */
@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject
    lateinit var sessionManager: SessionManager

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Timber.i("BootReceiver: action=$action")

        if (action in listOf(
                Intent.ACTION_BOOT_COMPLETED,
                Intent.ACTION_LOCKED_BOOT_COMPLETED,
                Intent.ACTION_MY_PACKAGE_REPLACED
            )
        ) {
            if (sessionManager.isLoggedIn() && sessionManager.isGatewayRegistered()) {
                Timber.i("BootReceiver: Starting gateway service after boot")
                context.startForegroundService(GatewayForegroundService.getStartIntent(context))
            } else {
                Timber.i("BootReceiver: User not logged in, skipping auto-start")
            }
        }
    }
}
