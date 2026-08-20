package com.smsgateway.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionManager @Inject constructor(@ApplicationContext private val context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    /** Encrypted prefs for auth tokens and user session data. Cleared on logout. */
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "sms_gateway_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    /**
     * Plain (unencrypted) prefs for device identity.
     * This is NEVER cleared on logout so the same device always
     * presents the same gatewayUid to the server and never creates
     * duplicate gateway rows.
     */
    private val devicePrefs = context.getSharedPreferences("sms_gateway_device", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_AUTH_TOKEN    = "auth_token"
        private const val KEY_GATEWAY_TOKEN = "gateway_token"
        private const val KEY_USERNAME      = "username"
        private const val KEY_TENANT_ID     = "tenant_id"
        private const val KEY_IS_LOGGED_IN  = "is_logged_in"
        private const val KEY_SERVER_URL    = "server_url"

        // Stored in devicePrefs — survives logout
        private const val KEY_GATEWAY_UID   = "gateway_uid"
    }

    fun saveLoginSession(token: String, username: String, tenantId: Long) {
        prefs.edit()
            .putString(KEY_AUTH_TOKEN, token)
            .putString(KEY_USERNAME, username)
            .putLong(KEY_TENANT_ID, tenantId)
            .putBoolean(KEY_IS_LOGGED_IN, true)
            .apply()
    }

    fun saveGatewaySession(gatewayUid: String, gatewayToken: String) {
        // Gateway UID goes to devicePrefs (persistent across logouts)
        devicePrefs.edit().putString(KEY_GATEWAY_UID, gatewayUid).apply()
        // Gateway token goes to encrypted prefs (cleared on logout)
        prefs.edit().putString(KEY_GATEWAY_TOKEN, gatewayToken).apply()
    }

    fun saveServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url).apply()
    }

    fun getAuthToken(): String? = prefs.getString(KEY_GATEWAY_TOKEN, null)
        ?: prefs.getString(KEY_AUTH_TOKEN, null)

    fun getGatewayToken(): String? = prefs.getString(KEY_GATEWAY_TOKEN, null)

    /** Always returns the same UID for this physical device, even after logout. */
    fun getGatewayUid(): String? = devicePrefs.getString(KEY_GATEWAY_UID, null)

    fun getUsername(): String? = prefs.getString(KEY_USERNAME, null)

    fun getTenantId(): Long = prefs.getLong(KEY_TENANT_ID, -1L)

    fun isLoggedIn(): Boolean = prefs.getBoolean(KEY_IS_LOGGED_IN, false)

    fun isGatewayRegistered(): Boolean = prefs.getString(KEY_GATEWAY_TOKEN, null) != null

    fun getServerUrl(): String = prefs.getString(KEY_SERVER_URL, "https://sms.simukitaa.com/") ?: "https://sms.simukitaa.com/"

    /**
     * Clears auth/session keys and devicePrefs so switching accounts
     * generates a fresh gateway UID and avoids showing previous account logs.
     */
    fun clearSession() {
        prefs.edit().clear().apply()
        devicePrefs.edit().clear().apply()
    }
}
