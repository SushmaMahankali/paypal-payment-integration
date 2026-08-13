package com.sushma.paypal.controller;

import java.util.Map;
import java.util.List;
import com.sushma.paypal.entity.PaymentTransaction;
import org.springframework.web.bind.annotation.PathVariable;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import com.sushma.paypal.dto.CreateOrderRequest;
import org.springframework.web.bind.annotation.CrossOrigin;
import com.sushma.paypal.service.PayPalService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/paypal")
public class PayPalController {

    private final PayPalService payPalService;

    public PayPalController(PayPalService payPalService) {
        this.payPalService = payPalService;
    }

    @GetMapping("/test")
    public String test() {
        return "PayPal Backend is Running!";
    }

    @GetMapping("/auth-test")
    public String testPayPalAuthentication() {

        String accessToken = payPalService.getAccessToken();

        if (accessToken != null && !accessToken.isEmpty()) {
            return "PayPal Authentication Successful!";
        }

        return "PayPal Authentication Failed!";
    }

    @PostMapping("/create-order")
    public Map<?, ?> createOrder(
            @RequestBody CreateOrderRequest request) {
        return payPalService.createOrder(request);
    }

    @PostMapping("/capture-order/{orderId}")
    public Map<?, ?> captureOrder(@PathVariable String orderId) {
        return payPalService.captureOrder(orderId);
    }

    @PostMapping("/refund/{captureId}")
    public Map<?, ?> refundPayment(@PathVariable String captureId) {
        return payPalService.refundPayment(captureId);
    }

    @GetMapping("/transactions")
    public List<PaymentTransaction> getAllTransactions() {
        return payPalService.getAllTransactions();
    }
}