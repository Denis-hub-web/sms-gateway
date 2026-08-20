package com.smsgateway.presentation.dashboard

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smsgateway.data.local.SessionManager
import com.smsgateway.domain.repository.GatewayRepository
import com.smsgateway.service.GatewayForegroundService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val gatewayUid: String = "",
    val gatewayStatus: String = "OFFLINE",
    val username: String = "",
    val pendingCount: Int = 0,
    val sentToday: Int = 0,
    val failedToday: Int = 0,
    val deliveredCount: Int = 0,
    val isServiceRunning: Boolean = false
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repository: GatewayRepository,
    private val sessionManager: SessionManager,
    private val smsDao: com.smsgateway.data.local.dao.SmsDao,
    private val logDao: com.smsgateway.data.local.dao.LogDao,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState(
        gatewayUid = sessionManager.getGatewayUid() ?: "",
        username = sessionManager.getUsername() ?: ""
    ))
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        observeSmsStats()
    }

    private fun observeSmsStats() {
        viewModelScope.launch {
            repository.observeAllSms().collect { messages ->
                val now = System.currentTimeMillis()
                val startOfDay = now - (now % 86_400_000)

                _uiState.update {
                    it.copy(
                        pendingCount = messages.count { m -> m.status in listOf("PENDING", "RETRY") },
                        sentToday = messages.count { m -> m.status == "SENT" && (m.sentAt ?: 0) >= startOfDay },
                        failedToday = messages.count { m -> m.status == "FAILED" && (m.failedAt ?: 0) >= startOfDay },
                        deliveredCount = messages.count { m -> m.status == "DELIVERED" }
                    )
                }
            }
        }
    }

    fun startGateway() {
        context.startForegroundService(GatewayForegroundService.getStartIntent(context))
        _uiState.update { it.copy(isServiceRunning = true, gatewayStatus = "ONLINE") }
    }

    fun stopGateway() {
        context.startService(GatewayForegroundService.getStopIntent(context))
        _uiState.update { it.copy(isServiceRunning = false, gatewayStatus = "OFFLINE") }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            stopGateway()
            delay(500)
            try {
                smsDao.deleteAll()
                logDao.deleteAll()
            } catch (_: Exception) {}
            sessionManager.clearSession()
            onDone()
        }
    }
}
