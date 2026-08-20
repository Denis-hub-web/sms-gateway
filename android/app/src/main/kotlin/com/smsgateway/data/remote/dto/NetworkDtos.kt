package com.smsgateway.data.remote.dto

import com.google.gson.annotations.SerializedName

data class LoginRequestDto(
    val username: String,
    val password: String
)

data class LoginResponseDto(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String,
    @SerializedName("username") val username: String,
    @SerializedName("userId") val userId: Long,
    @SerializedName("tenantId") val tenantId: Long
)

data class GatewayRegistrationDto(
    val displayName: String,
    val gatewayUid: String,
    val deviceName: String?,
    val androidVersion: String?,
    val phoneNumber: String?,
    val simOperator: String?,
    val simSerial: String?,
    val batteryLevel: Int?,
    val signalStrength: Int?
)

data class GatewayRegistrationResponseDto(
    val gatewayUid: String,
    val authToken: String,
    val displayName: String,
    val gatewayId: Long
)

data class SmsJobDto(
    val messageId: String,
    val phoneNumber: String,
    val message: String,
    val messageType: String,
    val priority: Int
)

data class GatewayStatusDto(
    val status: String,
    val batteryLevel: Int?,
    val signalStrength: Int?,
    val simOperator: String?,
    val phoneNumber: String?
)

data class DeliveryReportDto(
    val messageId: String,
    val status: String,          // SENT, DELIVERED, FAILED, TIMEOUT
    val errorCode: String?,
    val errorMessage: String?
)

data class ApiResponseDto(
    val success: Boolean,
    val message: String
)
