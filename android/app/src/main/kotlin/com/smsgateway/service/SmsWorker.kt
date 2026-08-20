package com.smsgateway.service

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.smsgateway.BuildConfig
import com.smsgateway.data.local.SessionManager
import com.smsgateway.data.local.entity.SmsEntity
import com.smsgateway.data.remote.dto.DeliveryReportDto
import com.smsgateway.data.remote.dto.GatewayStatusDto
import com.smsgateway.domain.repository.GatewayRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * Core background worker that:
 * 1. Fetches pending SMS jobs from the server
 * 2. Sends them via SmsManager (single/multipart/unicode)
 * 3. Reports delivery status back to server
 * 4. Runs on a recurring schedule via WorkManager
 */
@HiltWorker
class SmsWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val repository: GatewayRepository,
    private val sessionManager: SessionManager
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val WORK_NAME = "SmsGatewayWorker"
        const val ACTION_SMS_SENT = "SMS_SENT"
        const val ACTION_SMS_DELIVERED = "SMS_DELIVERED"
        const val EXTRA_MESSAGE_UID = "message_uid"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<SmsWorker>(
                BuildConfig.POLL_INTERVAL_SECONDS.toLong(), TimeUnit.SECONDS
            )
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun triggerOneTime(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SmsWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "SmsGatewayOneTime",
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        fun cancelAll(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            WorkManager.getInstance(context).cancelUniqueWork("SmsGatewayOneTime")
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Timber.d("SmsWorker: Starting job poll cycle")

        if (!sessionManager.isGatewayRegistered()) {
            Timber.w("SmsWorker: Gateway not registered, skipping")
            return@withContext Result.success()
        }

        try {
            // 1. Send heartbeat
            sendHeartbeat()

            // 2. Fetch jobs from server
            val fetchResult = repository.fetchJobs()
            if (fetchResult.isSuccess) {
                val jobs = fetchResult.getOrDefault(emptyList())
                Timber.d("SmsWorker: Fetched ${jobs.size} jobs")
                if (jobs.isNotEmpty()) {
                    repository.insertSmsJobs(jobs)
                    repository.writeLog("INFO", "SmsWorker", "Fetched ${jobs.size} new jobs")
                }
            }

            // 3. Process local pending queue
            val pending = repository.observePendingSms().first()
            Timber.d("SmsWorker: Processing ${pending.size} pending messages")

            for (sms in pending) {
                processSms(sms)
                delay(BuildConfig.MESSAGE_DELAY_MS.toLong())
            }

            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "SmsWorker: Fatal error")
            repository.writeLog("ERROR", "SmsWorker", "Worker error: ${e.message}")
            Result.retry()
        }
    }

    private suspend fun processSms(sms: SmsEntity) {
        if (!hasSmsPermission()) {
            Timber.e("SmsWorker: Missing SEND_SMS permission")
            return
        }

        try {
            repository.updateSmsStatus(sms.messageUid, "SENDING")

            val sentIntent = createPendingIntent(ACTION_SMS_SENT, sms.messageUid)
            val deliveredIntent = createPendingIntent(ACTION_SMS_DELIVERED, sms.messageUid)

            when (sms.messageType) {
                "UNICODE"   -> sendUnicodeSms(sms, sentIntent, deliveredIntent)
                "MULTIPART" -> sendMultipartSms(sms, sentIntent, deliveredIntent)
                else        -> sendSingleSms(sms, sentIntent, deliveredIntent)
            }

            repository.updateSmsStatus(sms.messageUid, "SENT")
            repository.submitDeliveryReport(
                DeliveryReportDto(
                    messageId = sms.messageUid,
                    status = "SENT",
                    errorCode = null,
                    errorMessage = null
                )
            )

            repository.writeLog("INFO", "SmsWorker",
                "SMS dispatched to carrier: ${sms.phoneNumber}", sms.messageUid)

        } catch (e: Exception) {
            Timber.e(e, "SmsWorker: Failed to send SMS ${sms.messageUid}")
            val canRetry = sms.retryCount < BuildConfig.MAX_RETRY_ATTEMPTS
            repository.markSmsFailed(sms.messageUid, e.message, canRetry)
            repository.writeLog("ERROR", "SmsWorker",
                "Send failed: ${e.message}", sms.messageUid)

            // Report failure immediately
            repository.submitDeliveryReport(
                DeliveryReportDto(
                    messageId = sms.messageUid,
                    status = "FAILED",
                    errorCode = "SEND_ERROR",
                    errorMessage = e.message
                )
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun getSmsManager(): SmsManager {
        return try {
            val subId = SmsManager.getDefaultSmsSubscriptionId()
            if (subId != android.telephony.SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                SmsManager.getSmsManagerForSubscriptionId(subId)
            } else {
                SmsManager.getDefault()
            }
        } catch (e: Exception) {
            SmsManager.getDefault()
        }
    }

    private fun sendSingleSms(sms: SmsEntity, sentIntent: PendingIntent, deliveredIntent: PendingIntent) {
        getSmsManager().sendTextMessage(
            sms.phoneNumber, null, sms.message, sentIntent, deliveredIntent
        )
    }

    private fun sendMultipartSms(sms: SmsEntity, sentIntent: PendingIntent, deliveredIntent: PendingIntent) {
        val manager = getSmsManager()
        val parts = manager.divideMessage(sms.message)
        val sentIntents = ArrayList(parts.map { sentIntent })
        val deliveredIntents = ArrayList(parts.map { deliveredIntent })
        manager.sendMultipartTextMessage(
            sms.phoneNumber, null, parts, sentIntents, deliveredIntents
        )
    }

    private fun sendUnicodeSms(sms: SmsEntity, sentIntent: PendingIntent, deliveredIntent: PendingIntent) {
        val manager = getSmsManager()
        val bytes = sms.message.toByteArray(Charsets.UTF_16BE)
        manager.sendDataMessage(
            sms.phoneNumber, null, 0, bytes, sentIntent, deliveredIntent
        )
    }

    private fun createPendingIntent(action: String, messageUid: String): PendingIntent {
        val intent = Intent(action).apply {
            setPackage(applicationContext.packageName)
            putExtra(EXTRA_MESSAGE_UID, messageUid)
        }
        return PendingIntent.getBroadcast(
            applicationContext,
            messageUid.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private suspend fun sendHeartbeat() {
        try {
            repository.heartbeat(null)
        } catch (e: Exception) {
            Timber.w("SmsWorker: Heartbeat failed: ${e.message}")
        }
    }

    private fun hasSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            applicationContext, Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }
}
