package com.smsgateway.domain.repository

import com.smsgateway.data.local.entity.LogEntity
import com.smsgateway.data.local.entity.SmsEntity
import com.smsgateway.data.remote.dto.*
import kotlinx.coroutines.flow.Flow

interface GatewayRepository {

    // Auth
    suspend fun login(username: String, password: String): Result<LoginResponseDto>
    suspend fun registerGateway(request: GatewayRegistrationDto): Result<GatewayRegistrationResponseDto>

    // Jobs
    suspend fun fetchJobs(): Result<List<SmsJobDto>>

    // Status
    suspend fun updateStatus(status: GatewayStatusDto): Result<Unit>
    suspend fun heartbeat(status: GatewayStatusDto?): Result<Unit>

    // Reports
    suspend fun submitDeliveryReport(report: DeliveryReportDto): Result<Unit>

    // Local SMS
    fun observeAllSms(): Flow<List<SmsEntity>>
    fun observePendingSms(): Flow<List<SmsEntity>>
    suspend fun insertSmsJobs(jobs: List<SmsJobDto>)
    suspend fun updateSmsStatus(uid: String, status: String)
    suspend fun markSmsFailed(uid: String, error: String?, retried: Boolean)

    // Logs
    fun observeLogs(): Flow<List<LogEntity>>
    suspend fun writeLog(level: String, tag: String, message: String, details: String? = null)
}
