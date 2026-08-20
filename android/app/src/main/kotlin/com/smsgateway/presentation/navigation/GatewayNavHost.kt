package com.smsgateway.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smsgateway.presentation.dashboard.DashboardScreen
import com.smsgateway.presentation.login.LoginScreen
import com.smsgateway.presentation.login.LoginViewModel
import com.smsgateway.presentation.logs.LogsScreen
import com.smsgateway.presentation.queue.QueueScreen

object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val QUEUE = "queue"
    const val LOGS = "logs"
}

@Composable
fun GatewayNavHost(navController: NavHostController = rememberNavController()) {
    val loginViewModel: LoginViewModel = hiltViewModel()
    val isLoggedIn by loginViewModel.isLoggedIn.collectAsState()

    NavHost(
        navController = navController,
        startDestination = if (isLoggedIn) Routes.DASHBOARD else Routes.LOGIN
    ) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.DASHBOARD) {
            DashboardScreen(
                onNavigateToQueue = { navController.navigate(Routes.QUEUE) },
                onNavigateToLogs  = { navController.navigate(Routes.LOGS) },
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.QUEUE) {
            QueueScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.LOGS) {
            LogsScreen(onBack = { navController.popBackStack() })
        }
    }
}
