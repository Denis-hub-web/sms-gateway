package com.smsgateway.data.repository

import com.smsgateway.data.local.SessionManager
import com.smsgateway.data.local.dao.LogDao
import com.smsgateway.data.local.dao.SmsDao
import com.smsgateway.data.local.entity.LogEntity
import com.smsgateway.data.local.entity.SmsEntity
import com.smsgateway.data.remote.GatewayApiService
import com.smsgateway.data.remote.dto.*
import com.smsgateway.domain.repository.GatewayRepository
import kotlinx.coroutines.flow.Flow
import timber.log.Timber
import javax.inject.Inject

class GatewayRepositoryImpl @Inject constructor(
    private val apiService: GatewayApiService,
    private val smsDao: SmsDao,
    private val logDao: LogDao,
    private val sessionManager: SessionManager
) : GatewayRepository {

    override suspend fun login(username: String, password: String): Result<LoginResponseDto> {
        return try {
            val response = apiService.login(LoginRequestDto(username, password))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Login failed: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Login failed")
            Result.failure(e)
        }
    }

    override suspend fun registerGateway(request: GatewayRegistrationDto): Result<GatewayRegistrationResponseDto> {
        return try {
            val response = apiService.register(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Registration failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Gateway registration failed")
            Result.failure(e)
        }
    }

    override suspend fun fetchJobs(): Result<List<SmsJobDto>> {
        return try {
            val response = apiService.getJobs()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to fetch jobs: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateStatus(status: GatewayStatusDto): Result<Unit> {
        return try {
            apiService.updateStatus(status)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun heartbeat(status: GatewayStatusDto?): Result<Unit> {
        return try {
            apiService.heartbeat(status)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun submitDeliveryReport(report: DeliveryReportDto): Result<Unit> {
        return try {
            val response = apiService.submitReport(report)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Report failed: ${response.code()}"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun observeAllSms(): Flow<List<SmsEntity>> = smsDao.observeAll()

    override fun observePendingSms(): Flow<List<SmsEntity>> = smsDao.observePending()

    override suspend fun insertSmsJobs(jobs: List<SmsJobDto>) {
        val entities = jobs.map { job ->
            SmsEntity(
                messageUid = job.messageId,
                phoneNumber = job.phoneNumber,
                message = job.message,
                messageType = job.messageType,
                priority = job.priority,
                status = "PENDING"
            )
        }
        smsDao.insertAll(entities)
    }

    override suspend fun updateSmsStatus(uid: String, status: String) {
        smsDao.updateStatus(uid, status)
    }

    override suspend fun markSmsFailed(uid: String, error: String?, retried: Boolean) {
        smsDao.markFailed(
            uid = uid,
            status = if (retried) "RETRY" else "FAILED",
            error = error,
            failedAt = System.currentTimeMillis()
        )
    }

    override fun observeLogs(): Flow<List<LogEntity>> = logDao.observeLogs()

    override suspend fun writeLog(level: String, tag: String, message: String, details: String?) {
        logDao.insert(LogEntity(level = level, tag = tag, message = message, details = details))
        logDao.pruneToLimit()
    }
}
