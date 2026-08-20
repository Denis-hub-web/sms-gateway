package com.smsgateway.presentation.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF00BFA5),
    onPrimary = Color.White,
    primaryContainer = Color(0xFF004D40),
    secondary = Color(0xFF64FFDA),
    onSecondary = Color(0xFF003731),
    background = Color(0xFF0D1117),
    surface = Color(0xFF1A1A2E),
    onBackground = Color.White,
    onSurface = Color.White,
    error = Color(0xFFEF5350)
)

@Composable
fun SmsGatewayTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
