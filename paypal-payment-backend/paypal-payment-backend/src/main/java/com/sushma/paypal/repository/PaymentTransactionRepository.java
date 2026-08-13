package com.sushma.paypal.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sushma.paypal.entity.PaymentTransaction;

public interface PaymentTransactionRepository
        extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByOrderId(String orderId);

    Optional<PaymentTransaction> findByCaptureId(String captureId);

    List<PaymentTransaction> findAllByOrderByCreatedAtDesc();
}