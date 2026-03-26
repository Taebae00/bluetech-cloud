package com.example.bluetechcloud.model;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PhotoDTO {

    private Long id;
    private Long result_id;
    private String file_url;
    private LocalDateTime created_at;
}
