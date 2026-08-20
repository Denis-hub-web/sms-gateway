package com.smsgateway.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "event_logs",
    indices = [Index("createdAt")]
)
data class LogEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val level: String,         // INFO, WARN, ERROR, DEBUG
    val tag: String,
    val message: String,
    val details: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
