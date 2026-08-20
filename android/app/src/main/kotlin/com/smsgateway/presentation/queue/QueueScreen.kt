package com.smsgateway.presentation.queue

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.smsgateway.data.local.entity.SmsEntity
import com.smsgateway.domain.repository.GatewayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

@HiltViewModel
class QueueViewModel @Inject constructor(repository: GatewayRepository) : ViewModel() {
    val messages: StateFlow<List<SmsEntity>> = repository.observeAllSms()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueScreen(onBack: () -> Unit, viewModel: QueueViewModel = hiltViewModel()) {
    val messages: List<SmsEntity> by viewModel.messages.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SMS Queue (${messages.size})", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, null, tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0D1117))
            )
        },
        containerColor = Color(0xFF0D1117)
    ) { padding ->
        if (messages.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Inbox, null, tint = Color(0xFF455A64), modifier = Modifier.size(64.dp))
                    Spacer(Modifier.height(8.dp))
                    Text("No messages in queue", color = Color(0xFF607D8B))
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(items = messages, key = { item: SmsEntity -> item.id }) { sms ->
                    SmsQueueCard(sms)
                }
            }
        }
    }
}

@Composable
fun SmsQueueCard(sms: SmsEntity) {
    val (statusColor, statusIcon) = when (sms.status) {
        "PENDING"   -> Color(0xFFFFA726) to Icons.Default.Schedule
        "SENDING"   -> Color(0xFF42A5F5) to Icons.Default.Sync
        "SENT"      -> Color(0xFF66BB6A) to Icons.Default.Send
        "DELIVERED" -> Color(0xFF00E676) to Icons.Default.DoneAll
        "FAILED"    -> Color(0xFFEF5350) to Icons.Default.Error
        "RETRY"     -> Color(0xFFFF7043) to Icons.Default.Refresh
        else        -> Color(0xFF90A4AE) to Icons.Default.Help
    }

    val dateFormat = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status icon
            Icon(statusIcon, null, tint = statusColor, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = sms.phoneNumber,
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                    Spacer(Modifier.width(8.dp))
                    // Priority badge
                    Surface(
                        color = Color(0xFF2D2D4A),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = "P${sms.priority}",
                            color = Color(0xFF64FFDA),
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    text = sms.message,
                    color = Color(0xFF90A4AE),
                    fontSize = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(4.dp))
                Row {
                    Text(
                        text = dateFormat.format(Date(sms.createdAt)),
                        color = Color(0xFF546E7A),
                        fontSize = 11.sp
                    )
                    if (sms.retryCount > 0) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Retry #${sms.retryCount}",
                            color = Color(0xFFFF7043),
                            fontSize = 11.sp
                        )
                    }
                }
            }

            Spacer(Modifier.width(8.dp))

            // Status chip
            Surface(
                color = statusColor.copy(alpha = 0.15f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = sms.status,
                    color = statusColor,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}
