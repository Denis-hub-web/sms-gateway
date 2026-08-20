package com.smsgateway.presentation.logs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.smsgateway.data.local.entity.LogEntity
import com.smsgateway.domain.repository.GatewayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

@HiltViewModel
class LogsViewModel @Inject constructor(repository: GatewayRepository) : ViewModel() {
    val logs: StateFlow<List<LogEntity>> = repository.observeLogs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogsScreen(onBack: () -> Unit, viewModel: LogsViewModel = hiltViewModel()) {
    val logs: List<LogEntity> by viewModel.logs.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Event Logs", color = Color.White, fontWeight = FontWeight.Bold) },
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
        if (logs.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.BugReport, null, tint = Color(0xFF455A64), modifier = Modifier.size(64.dp))
                    Spacer(Modifier.height(8.dp))
                    Text("No logs yet", color = Color(0xFF607D8B))
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(items = logs, key = { item: LogEntity -> item.id }) { log ->
                    LogRow(log)
                }
            }
        }
    }
}

@Composable
fun LogRow(log: LogEntity) {
    val (levelColor, bgColor) = when (log.level) {
        "ERROR" -> Color(0xFFEF5350) to Color(0x22EF5350)
        "WARN"  -> Color(0xFFFFA726) to Color(0x22FFA726)
        "INFO"  -> Color(0xFF42A5F5) to Color(0x2242A5F5)
        else    -> Color(0xFF90A4AE) to Color(0x22455A64)
    }

    val fmt = remember { SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(6.dp),
        color = bgColor
    ) {
        Row(modifier = Modifier.padding(8.dp), verticalAlignment = Alignment.Top) {
            Text(
                text = "[${log.level}]",
                color = levelColor,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.width(56.dp)
            )
            Spacer(Modifier.width(4.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = log.message,
                    color = Color(0xFFCFD8DC),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
                log.details?.let {
                    Text(it, color = Color(0xFF78909C), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }
            Text(
                text = fmt.format(Date(log.createdAt)),
                color = Color(0xFF546E7A),
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
