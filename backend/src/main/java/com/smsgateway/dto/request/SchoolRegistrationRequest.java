package com.smsgateway.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SchoolRegistrationRequest {

    @NotBlank
    private String schoolName;

    private String schoolType = "PRIVATE";

    private String region;

    private Integer studentCount;

    @NotBlank
    private String adminName;

    @NotBlank
    @Email
    private String email;

    private String phone;

    @NotBlank
    @Size(min = 8)
    private String password;

    private String plan = "STARTER";
}
