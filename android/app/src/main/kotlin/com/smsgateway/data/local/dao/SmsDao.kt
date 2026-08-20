package com.smsgateway.data.local.dao

import androidx.room.*
import com.smsgateway.data.local.entity.SmsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SmsDao {

    @Query("SELECT * FROM sms_messages ORDER BY priority DESC, createdAt ASC")
    fun observeAll(): Flow<List<SmsEntity>>

    @Query("SELECT * FROM sms_messages WHERE status IN ('PENDING','RETRY') ORDER BY priority DESC, createdAt ASC")
    fun observePending(): Flow<List<SmsEntity>>

    @Query("SELECT * FROM sms_messages WHERE messageUid = :uid LIMIT 1")
    suspend fun findByUid(uid: String): SmsEntity?

    @Query("SELECT COUNT(*) FROM sms_messages WHERE status = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(messages: List<SmsEntity>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(message: SmsEntity): Long

    @Update
    suspend fun update(message: SmsEntity)

    @Query("UPDATE sms_messages SET status = :status WHERE messageUid = :uid")
    suspend fun updateStatus(uid: String, status: String)

    @Query("""
        UPDATE sms_messages SET status = :status, errorMessage = :error,
        retryCount = retryCount + 1, failedAt = :failedAt
        WHERE messageUid = :uid
    """)
    suspend fun markFailed(uid: String, status: String, error: String?, failedAt: Long)

    @Query("SELECT COUNT(*) FROM sms_messages WHERE status = 'SENT' AND sentAt >= :from AND sentAt < :to")
    suspend fun countSentToday(from: Long, to: Long): Int

    @Query("SELECT COUNT(*) FROM sms_messages WHERE status = 'FAILED' AND failedAt >= :from AND failedAt < :to")
    suspend fun countFailedToday(from: Long, to: Long): Int

    @Query("SELECT COUNT(*) FROM sms_messages WHERE status = 'DELIVERED'")
    suspend fun countDelivered(): Int

    @Query("DELETE FROM sms_messages WHERE createdAt < :before AND status IN ('SENT','DELIVERED','FAILED')")
    suspend fun deleteOlderThan(before: Long)

    @Query("DELETE FROM sms_messages")
    suspend fun deleteAll()
}
