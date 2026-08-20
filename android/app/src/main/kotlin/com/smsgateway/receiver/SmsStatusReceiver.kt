package com.smsgateway.receiver

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import com.smsgateway.data.remote.dto.DeliveryReportDto
import com.smsgateway.domain.repository.GatewayRepository
import com.smsgateway.service.SmsWorker
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * Captures SENT and DELIVERED status broadcasts from SmsManager
 * and reports back to the server.
 */
@AndroidEntryPoint
class SmsStatusReceiver : BroadcastReceiver() {

    @Inject
    lateinit var repository: GatewayRepository

    override fun onReceive(context: Context, intent: Intent) {
        val messageUid = intent.getStringExtra(SmsWorker.EXTRA_MESSAGE_UID) ?: return
        val action = intent.action ?: return

        Timber.d("SmsStatusReceiver: action=$action uid=$messageUid resultCode=$resultCode")

        CoroutineScope(Dispatchers.IO).launch {
            when (action) {
                SmsWorker.ACTION_SMS_SENT -> handleSent(messageUid)
                SmsWorker.ACTION_SMS_DELIVERED -> handleDelivered(messageUid)
            }
        }
    }

    private suspend fun handleSent(messageUid: String) {
        val (status, errorCode, errorMsg) = when (resultCode) {
            Activity.RESULT_OK ->
                Triple("SENT", null, null)
            SmsManager.RESULT_ERROR_GENERIC_FAILURE ->
                Triple("FAILED", "GENERIC_FAILURE", "Generic failure")
            SmsManager.RESULT_ERROR_NO_SERVICE ->
                Triple("FAILED", "NO_SERVICE", "No cellular service")
            SmsManager.RESULT_ERROR_NULL_PDU ->
                Triple("FAILED", "NULL_PDU", "Null PDU error")
            SmsManager.RESULT_ERROR_RADIO_OFF ->
                Triple("FAILED", "RADIO_OFF", "Radio is turned off")
            else ->
                Triple("FAILED", "UNKNOWN", "Unknown error: $resultCode")
        }

        repository.updateSmsStatus(messageUid, status)
        if (status == "SENT") {
            repository.writeLog("INFO", "SMS", "Sent: $messageUid")
        } else {
            repository.writeLog("ERROR", "SMS", "Send failed: $errorCode", messageUid)
        }

        repository.submitDeliveryReport(
            DeliveryReportDto(
                messageId = messageUid,
                status = status,
                errorCode = errorCode,
                errorMessage = errorMsg
            )
        )
    }

    private suspend fun handleDelivered(messageUid: String) {
        if (resultCode == Activity.RESULT_OK) {
            repository.updateSmsStatus(messageUid, "DELIVERED")
            repository.writeLog("INFO", "SMS", "Delivered: $messageUid")
            repository.submitDeliveryReport(
                DeliveryReportDto(
                    messageId = messageUid,
                    status = "DELIVERED",
                    errorCode = null,
                    errorMessage = null
                )
            )
        }
    }
}
