package com.example.bluetechcloud.model;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SiteDTO {

    private Long id;
    private String site_name;
    private LocalDateTime work_date;
    private Long created_by;
    private LocalDateTime created_at;
}
