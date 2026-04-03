package com.example.bluetechcloud.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "inspection_item")
public class InspectionItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "category")
    private String category;

    @Column(name = "code")
    private String code;

    @Column(name = "content")
    private String content;

    @Column(name = "order_no")
    private int orderNo;

    @Column(name = "category_order")
    private int categoryOrder;

    @Column(name = "work_type")
    private String workType;
}
