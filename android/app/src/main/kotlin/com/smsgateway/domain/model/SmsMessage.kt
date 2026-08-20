package com.smsgateway.domain.model

data class SmsMessage(
    val id: Long = 0,
    val messageUid: String,
    val phoneNumber: String,
    val message: String,
    val messageType: MessageType = MessageType.SINGLE,
    val priority: Int = 5,
    val status: MessageStatus = MessageStatus.PENDING,
    val retryCount: Int = 0,
    val errorMessage: String? = null,
    val sentAt: Long? = null,
    val deliveredAt: Long? = null,
    val failedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)

enum class MessageType { SINGLE, MULTIPART, UNICODE }

enum class MessageStatus { PENDING, SENDING, SENT, DELIVERED, FAILED, RETRY }
