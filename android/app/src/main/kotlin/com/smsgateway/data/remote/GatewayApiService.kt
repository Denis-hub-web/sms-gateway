package com.smsgateway.data.remote

import com.smsgateway.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface GatewayApiService {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequestDto): Response<LoginResponseDto>

    @POST("api/gateway/register")
    suspend fun register(@Body request: GatewayRegistrationDto): Response<GatewayRegistrationResponseDto>

    @GET("api/gateway/jobs")
    suspend fun getJobs(): Response<List<SmsJobDto>>

    @POST("api/gateway/status")
    suspend fun updateStatus(@Body request: GatewayStatusDto): Response<ApiResponseDto>

    @POST("api/gateway/report")
    suspend fun submitReport(@Body request: DeliveryReportDto): Response<ApiResponseDto>

    @POST("api/gateway/heartbeat")
    suspend fun heartbeat(@Body request: GatewayStatusDto?): Response<ApiResponseDto>
}
