package com.example.bluetechcloud.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "photo")
public class PhotoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "result_id")
    private Long resultId;

    @Column(name = "file_url")
    private String fileUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
