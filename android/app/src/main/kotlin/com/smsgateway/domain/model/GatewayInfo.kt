package com.smsgateway.domain.model

data class GatewayInfo(
    val gatewayUid: String,
    val displayName: String,
    val deviceName: String,
    val androidVersion: String,
    val phoneNumber: String?,
    val simOperator: String?,
    val batteryLevel: Int,
    val signalStrength: Int,
    val status: GatewayStatus,
    val lastSync: Long?
)

enum class GatewayStatus { ONLINE, OFFLINE, SENDING, FAILED }
