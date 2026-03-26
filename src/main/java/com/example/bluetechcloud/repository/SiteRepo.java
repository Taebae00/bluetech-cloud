package com.example.bluetechcloud.repository;

import com.example.bluetechcloud.entity.SiteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteRepo extends JpaRepository<SiteEntity, Long> {


    List<SiteEntity> findByCreatedBy(Long createdBy);

    List<SiteEntity> findByCreatedByOrderByIdDesc(Long userId);
}
