package com.smsgateway.presentation.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smsgateway.data.local.SessionManager
import com.smsgateway.data.remote.dto.GatewayRegistrationDto
import com.smsgateway.domain.repository.GatewayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject
import android.os.Build

data class LoginUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val error: String? = null,
    val username: String = "",
    val password: String = "",
    val serverUrl: String = "https://sms.simukitaa.com/"
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repository: GatewayRepository,
    private val sessionManager: SessionManager,
    private val smsDao: com.smsgateway.data.local.dao.SmsDao,
    private val logDao: com.smsgateway.data.local.dao.LogDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        LoginUiState(
            isLoggedIn = sessionManager.isLoggedIn(),
            serverUrl = sessionManager.getServerUrl()
        )
    )
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    val isLoggedIn: StateFlow<Boolean> = MutableStateFlow(sessionManager.isLoggedIn()).asStateFlow()

    fun onUsernameChange(value: String) = _uiState.update { it.copy(username = value) }
    fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value) }
    fun onServerUrlChange(value: String) = _uiState.update { it.copy(serverUrl = value) }

    fun login() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            sessionManager.saveServerUrl(_uiState.value.serverUrl)

            val result = repository.login(_uiState.value.username, _uiState.value.password)
            if (result.isSuccess) {
                // Clear any leftover local Room DB logs from previous accounts
                try {
                    smsDao.deleteAll()
                    logDao.deleteAll()
                } catch (_: Exception) {}

                val loginData = result.getOrThrow()
                sessionManager.saveLoginSession(
                    loginData.accessToken, loginData.username, loginData.tenantId
                )

                // Auto-register this device as a gateway
                registerGateway(loginData.accessToken)
            } else {
                _uiState.update {
                    it.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Login failed")
                }
            }
        }
    }

    private suspend fun registerGateway(userToken: String) {
        // Generate stable UID for this device
        val gatewayUid = sessionManager.getGatewayUid() ?: UUID.randomUUID().toString().also {
            sessionManager.saveGatewaySession(it, userToken) // Temp save
        }

        val request = GatewayRegistrationDto(
            displayName = "${Build.MANUFACTURER} ${Build.MODEL}",
            gatewayUid = gatewayUid,
            deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
            androidVersion = "Android ${Build.VERSION.RELEASE}",
            phoneNumber = null, // Retrieved later with READ_PHONE_STATE
            simOperator = null,
            simSerial = null,
            batteryLevel = null,
            signalStrength = null
        )

        val regResult = repository.registerGateway(request)
        if (regResult.isSuccess) {
            val regData = regResult.getOrThrow()
            sessionManager.saveGatewaySession(regData.gatewayUid, regData.authToken)
            _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
        } else {
            _uiState.update {
                it.copy(isLoading = false,
                    error = "Login OK but gateway registration failed. " + regResult.exceptionOrNull()?.message)
            }
        }
    }

    fun clearError() = _uiState.update { it.copy(error = null) }
}
