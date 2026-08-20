package com.smsgateway.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.smsgateway.data.local.dao.LogDao
import com.smsgateway.data.local.dao.SmsDao
import com.smsgateway.data.local.entity.LogEntity
import com.smsgateway.data.local.entity.SmsEntity

@Database(
    entities = [SmsEntity::class, LogEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun smsDao(): SmsDao
    abstract fun logDao(): LogDao
}
