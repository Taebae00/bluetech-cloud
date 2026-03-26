package com.example.bluetechcloud.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class InspectionItemDTO {

    private Long id;
    private String category;
    private String code;
    private String content;
    private int order_no;
    private int category_order;
}
