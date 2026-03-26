package com.example.bluetechcloud.repository;

import com.example.bluetechcloud.entity.InspectionItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InspectionItemRepo extends JpaRepository<InspectionItemEntity,Long> {

    List<InspectionItemEntity> findByCategoryOrderByOrderNoAsc(String category);

    @Query("select distinct i.category from InspectionItemEntity i order by min(i.categoryOrder)")
    List<String> findDistinctCategoryNames();

    List<InspectionItemEntity> findAllByOrderByCategoryOrderAscOrderNoAscIdAsc();

    List<InspectionItemEntity> findByCategoryOrderByOrderNoAscIdAsc(String category);

    @Query("select max(i.categoryOrder) from InspectionItemEntity i")
    Integer findMaxCategoryOrder();


}
