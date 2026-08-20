package com.smsgateway.repository;

import com.smsgateway.entity.DeliveryReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeliveryReportRepository extends JpaRepository<DeliveryReport, Long> {

    List<DeliveryReport> findByMessageUid(String messageUid);

    List<DeliveryReport> findByGatewayUid(String gatewayUid);
}
