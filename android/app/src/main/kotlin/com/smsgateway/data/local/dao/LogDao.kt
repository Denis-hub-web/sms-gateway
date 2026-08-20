package com.smsgateway.data.local.dao

import androidx.room.*
import com.smsgateway.data.local.entity.LogEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface LogDao {

    @Query("SELECT * FROM event_logs ORDER BY createdAt DESC LIMIT 500")
    fun observeLogs(): Flow<List<LogEntity>>

    @Insert
    suspend fun insert(log: LogEntity)

    @Query("DELETE FROM event_logs WHERE createdAt < :before")
    suspend fun deleteOlderThan(before: Long)

    @Query("DELETE FROM event_logs WHERE id NOT IN (SELECT id FROM event_logs ORDER BY createdAt DESC LIMIT 1000)")
    suspend fun pruneToLimit()

    @Query("DELETE FROM event_logs")
    suspend fun deleteAll()
}
