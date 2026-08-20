package com.smsgateway.presentation.dashboard

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToQueue: () -> Unit,
    onNavigateToLogs: () -> Unit,
    onLogout: () -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val smsGranted = permissions[Manifest.permission.SEND_SMS] == true
        if (smsGranted && !state.isServiceRunning) {
            viewModel.startGateway()
        }
    }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.SEND_SMS,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.POST_NOTIFICATIONS
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("SMS Gateway", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("@${state.username}", fontSize = 12.sp, color = Color(0xFF90A4AE))
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToLogs) {
                        Icon(Icons.Default.List, "Logs", tint = Color.White)
                    }
                    IconButton(onClick = { viewModel.logout(onLogout) }) {
                        Icon(Icons.Default.Logout, "Logout", tint = Color(0xFFEF5350))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0D1117))
            )
        },
        containerColor = Color(0xFF0D1117)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Gateway Status Card
            GatewayStatusCard(
                status = state.gatewayStatus,
                gatewayUid = state.gatewayUid,
                isRunning = state.isServiceRunning,
                onStart = viewModel::startGateway,
                onStop = viewModel::stopGateway
            )

            // Stats Grid
            Text("Today's Activity", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Pending",
                    value = state.pendingCount.toString(),
                    icon = Icons.Default.Schedule,
                    color = Color(0xFFFFA726)
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Sent",
                    value = state.sentToday.toString(),
                    icon = Icons.Default.Send,
                    color = Color(0xFF42A5F5)
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Delivered",
                    value = state.deliveredCount.toString(),
                    icon = Icons.Default.DoneAll,
                    color = Color(0xFF66BB6A)
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Failed",
                    value = state.failedToday.toString(),
                    icon = Icons.Default.Error,
                    color = Color(0xFFEF5350)
                )
            }

            Spacer(Modifier.height(4.dp))

            // Quick Actions
            Text("Quick Actions", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ActionButton(
                    modifier = Modifier.weight(1f),
                    text = "SMS Queue",
                    icon = Icons.Default.Queue,
                    onClick = onNavigateToQueue
                )
                ActionButton(
                    modifier = Modifier.weight(1f),
                    text = "Event Logs",
                    icon = Icons.Default.BugReport,
                    onClick = onNavigateToLogs
                )
            }
        }
    }
}

@Composable
fun GatewayStatusCard(
    status: String,
    gatewayUid: String,
    isRunning: Boolean,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    val statusColor = when (status) {
        "ONLINE"  -> Color(0xFF66BB6A)
        "SENDING" -> Color(0xFF42A5F5)
        "FAILED"  -> Color(0xFFEF5350)
        else      -> Color(0xFF90A4AE)
    }

    // Pulse animation for ONLINE state
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "alpha"
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        listOf(Color(0xFF1A1A2E), Color(0xFF16213E))
                    )
                )
                .padding(20.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(statusColor.copy(alpha = if (status == "ONLINE") alpha else 1f))
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(status, color = statusColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(Modifier.weight(1f))
                    Switch(
                        checked = isRunning,
                        onCheckedChange = { if (it) onStart() else onStop() },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFF00BFA5)
                        )
                    )
                }

                Divider(color = Color(0xFF2A2A4A))

                Row {
                    Icon(Icons.Default.VpnKey, null, tint = Color(0xFF64FFDA), modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "UID: ${gatewayUid.take(8)}...",
                        color = Color(0xFF90A4AE),
                        fontSize = 12.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
fun StatCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    icon: ImageVector,
    color: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(28.dp))
            Text(value, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 28.sp)
            Text(title, color = Color(0xFF90A4AE), fontSize = 12.sp)
        }
    }
}

@Composable
fun ActionButton(modifier: Modifier = Modifier, text: String, icon: ImageVector, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF64FFDA)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF64FFDA).copy(alpha = 0.4f))
    ) {
        Icon(icon, null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(text, fontSize = 13.sp)
    }
}
