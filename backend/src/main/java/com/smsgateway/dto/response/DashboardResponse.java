package com.smsgateway.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class DashboardResponse {
    private long totalGateways;
    private long onlineGateways;
    private long pendingSms;
    private long sentToday;
    private long deliveredToday;
    private long failedToday;
    private long totalSentAllTime;
}
