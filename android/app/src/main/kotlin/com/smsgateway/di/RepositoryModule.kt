package com.smsgateway.di

import com.smsgateway.data.local.SessionManager
import com.smsgateway.data.local.dao.LogDao
import com.smsgateway.data.local.dao.SmsDao
import com.smsgateway.data.remote.GatewayApiService
import com.smsgateway.data.repository.GatewayRepositoryImpl
import com.smsgateway.domain.repository.GatewayRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideGatewayRepository(
        apiService: GatewayApiService,
        smsDao: SmsDao,
        logDao: LogDao,
        sessionManager: SessionManager
    ): GatewayRepository = GatewayRepositoryImpl(apiService, smsDao, logDao, sessionManager)
}
