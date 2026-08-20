package com.smsgateway.di

import android.content.Context
import androidx.room.Room
import com.smsgateway.data.local.AppDatabase
import com.smsgateway.data.local.dao.SmsDao
import com.smsgateway.data.local.dao.LogDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "sms_gateway.db"
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideSmsDao(db: AppDatabase): SmsDao = db.smsDao()

    @Provides
    fun provideLogDao(db: AppDatabase): LogDao = db.logDao()
}
