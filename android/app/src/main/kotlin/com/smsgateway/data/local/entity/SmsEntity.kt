package com.smsgateway.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "sms_messages",
    indices = [
        Index("messageUid", unique = true),
        Index("status"),
        Index("createdAt")
    ]
)
data class SmsEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val messageUid: String,
    val phoneNumber: String,
    val message: String,
    val messageType: String = "SINGLE",  // SINGLE, MULTIPART, UNICODE
    val priority: Int = 5,
    val status: String = "PENDING",      // PENDING, SENDING, SENT, DELIVERED, FAILED, RETRY
    val retryCount: Int = 0,
    val errorMessage: String? = null,
    val sentAt: Long? = null,
    val deliveredAt: Long? = null,
    val failedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)
