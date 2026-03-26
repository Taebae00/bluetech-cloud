package com.example.bluetechcloud.repository;

import com.example.bluetechcloud.entity.InspectionResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InspectionResultRepo extends JpaRepository<InspectionResultEntity,Long> {

    List<InspectionResultEntity> findBySiteId(Long siteId);

    public interface InspectionResultRepository extends JpaRepository<InspectionResultEntity, Long> {
        List<InspectionResultEntity> findBySiteId(Long siteId);
    }

    Optional<InspectionResultEntity> findFirstBySiteIdAndItemIdAndCategoryGroupOrderByIdDesc(
            Long siteId, Long itemId, String categoryGroup
    );

    boolean existsBySiteIdAndItemIdAndCategoryGroup(Long siteId, Long itemId, String categoryGroup);

    void deleteBySiteId(Long siteId);

    Optional<InspectionResultEntity> findFirstBySiteIdAndItemIdOrderByIdDesc(Long siteId, Long itemId);

    Optional<InspectionResultEntity> findBySiteIdAndItemIdAndCategoryGroup(Long siteId, Long itemId, String categoryGroup);

    List<InspectionResultEntity> findBySiteIdAndCategoryGroup(Long siteId, String categoryGroup);

}
