package com.smsgateway.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.smsgateway.R
import com.smsgateway.data.local.SessionManager
import com.smsgateway.presentation.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import timber.log.Timber
import kotlinx.coroutines.*
import javax.inject.Inject

/**
 * Foreground service that keeps the gateway alive.
 * Displays a persistent notification showing gateway status.
 * WorkManager handles the actual polling; this service just
 * keeps the process alive and provides visible user feedback.
 */
@AndroidEntryPoint
class GatewayForegroundService : Service() {

    @Inject lateinit var sessionManager: SessionManager

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "sms_gateway_service"
        const val CHANNEL_NAME = "SMS Gateway Service"
        const val ACTION_STOP = "ACTION_STOP_GATEWAY"
        const val ACTION_START = "ACTION_START_GATEWAY"

        fun getStartIntent(context: android.content.Context) =
            Intent(context, GatewayForegroundService::class.java).apply {
                action = ACTION_START
            }

        fun getStopIntent(context: android.content.Context) =
            Intent(context, GatewayForegroundService::class.java).apply {
                action = ACTION_STOP
            }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var serviceJob: Job? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Timber.i("GatewayService: Stopping service")
                serviceJob?.cancel()
                SmsWorker.cancelAll(this)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            else -> {
                Timber.i("GatewayService: Starting foreground service")
                startForeground(NOTIFICATION_ID, buildNotification("Gateway Active", "Monitoring for messages..."))
                SmsWorker.schedule(this)
                startPollingLoop()
            }
        }
        return START_STICKY
    }

    private fun startPollingLoop() {
        serviceJob?.cancel()
        serviceJob = serviceScope.launch {
            while (isActive) {
                try {
                    SmsWorker.triggerOneTime(applicationContext)
                } catch (e: Exception) {
                    Timber.e(e, "Error triggering SmsWorker polling loop")
                }
                delay(10_000)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob?.cancel()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Restart if swiped from recents
        val restartIntent = Intent(applicationContext, GatewayForegroundService::class.java).apply {
            action = ACTION_START
        }
        startService(restartIntent)
    }

    fun updateNotification(title: String, text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(title, text))
    }

    private fun buildNotification(title: String, text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = PendingIntent.getService(
            this, 1,
            getStopIntent(this),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_sms_gateway)
            .setContentIntent(openIntent)
            .addAction(0, "Stop", stopIntent)
            .setOngoing(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "SMS Gateway background service"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
