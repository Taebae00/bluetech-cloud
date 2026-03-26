package com.example.bluetechcloud.service;

import com.example.bluetechcloud.entity.InspectionItemEntity;
import com.example.bluetechcloud.entity.InspectionResultEntity;
import com.example.bluetechcloud.entity.PhotoEntity;
import com.example.bluetechcloud.model.InspectionResultDTO;
import com.example.bluetechcloud.model.PhotoDTO;
import com.example.bluetechcloud.repository.InspectionItemRepo;
import com.example.bluetechcloud.repository.InspectionResultRepo;
import com.example.bluetechcloud.repository.PhotoRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class InspectionResultService {

    private final InspectionResultRepo inspectionResultRepo;
    private final InspectionItemRepo inspectionItemRepo;
    private final PhotoRepo photoRepo;
    private final FileService fileService;

    public InspectionResultService(InspectionResultRepo inspectionResultRepo, InspectionItemRepo inspectionItemRepo,
                                   PhotoRepo photoRepo,
                                   FileService fileService) {
        this.inspectionResultRepo = inspectionResultRepo;
        this.inspectionItemRepo = inspectionItemRepo;
        this.photoRepo = photoRepo;
        this.fileService = fileService;
    }

    @Transactional
    public void saveInspection(Long siteId,
                               Long itemId,
                               String categoryGroup,
                               String result,
                               String memo,
                               List<MultipartFile> photos) {

        InspectionResultEntity resultEntity = inspectionResultRepo
                .findFirstBySiteIdAndItemIdAndCategoryGroupOrderByIdDesc(siteId, itemId, categoryGroup)
                .orElseGet(() -> {
                    InspectionResultEntity newEntity = new InspectionResultEntity();
                    newEntity.setSiteId(siteId);
                    newEntity.setItemId(itemId);
                    newEntity.setCategoryGroup(categoryGroup);
                    return newEntity;
                });

        String safeResult = result == null ? "" : result.trim();
        String safeMemo = memo == null ? "" : memo.trim();

        boolean hasPhoto = photos != null && photos.stream().anyMatch(p -> p != null && !p.isEmpty());

        // 1) 해당사항없음 선택 시
        if ("해당사항없음".equals(safeResult)) {
            resultEntity.setResult("해당사항없음");
            resultEntity.setMemo("해당사항없음");
        }
        // 2) 메모나 사진이 있으면 자동으로 작성
        else if (!safeMemo.isBlank() || hasPhoto) {
            resultEntity.setResult("작성");
            resultEntity.setMemo(safeMemo);
        }
        // 3) 아무것도 없으면 미작성
        else {
            resultEntity.setResult("미작성");
            resultEntity.setMemo("");
        }

        InspectionResultEntity savedResult = inspectionResultRepo.save(resultEntity);

        if (photos != null && !photos.isEmpty()) {
            for (MultipartFile photo : photos) {
                if (photo == null || photo.isEmpty()) {
                    continue;
                }

                String fileUrl = fileService.upload(photo);

                PhotoEntity photoEntity = new PhotoEntity();
                photoEntity.setResultId(savedResult.getId());
                photoEntity.setFileUrl(fileUrl);

                photoRepo.save(photoEntity);
            }
        }
    }

    public List<InspectionResultDTO> getResultsBySiteId(Long siteId) {
        List<InspectionResultEntity> entityList = inspectionResultRepo.findBySiteId(siteId);

        return entityList.stream()
                .map(entity -> InspectionResultDTO.builder()
                        .id(entity.getId())
                        .site_id(entity.getSiteId())
                        .item_id(entity.getItemId())
                        .category_group(entity.getCategoryGroup()) // ⭐ 추가
                        .result(entity.getResult())
                        .memo(entity.getMemo())
                        .created_at(entity.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public InspectionResultEntity getInspectionResult(Long siteId, Long itemId, String categoryGroup) {
        return inspectionResultRepo
                .findFirstBySiteIdAndItemIdAndCategoryGroupOrderByIdDesc(siteId, itemId, categoryGroup)
                .orElse(null);
    }

    @Transactional
    public void deletePhoto(Long photoId) {

        PhotoEntity photo = photoRepo.findById(photoId)
                .orElseThrow(() -> new RuntimeException("사진 없음"));

        fileService.delete(photo.getFileUrl()); // S3 삭제
        photoRepo.delete(photo);                // DB 삭제
    }

    @Transactional
    public void addCategoryGroup(Long siteId, String templateCategory, String newCategoryName) {

        if (templateCategory == null || templateCategory.isBlank()) {
            throw new RuntimeException("대주제가 없습니다.");
        }
        if (newCategoryName == null || newCategoryName.isBlank()) {
            throw new RuntimeException("위치명이 없습니다.");
        }

        templateCategory = templateCategory.trim();
        newCategoryName = newCategoryName.trim();

        if ("null".equalsIgnoreCase(newCategoryName)) {
            throw new RuntimeException("위치명이 올바르지 않습니다.");
        }

        String newGroupName = templateCategory + "_" + newCategoryName;

        List<InspectionItemEntity> items =
                inspectionItemRepo.findByCategoryOrderByOrderNoAsc(templateCategory);

        for (InspectionItemEntity item : items) {
            boolean exists = inspectionResultRepo.existsBySiteIdAndItemIdAndCategoryGroup(
                    siteId, item.getId(), newGroupName
            );

            if (!exists) {
                InspectionResultEntity entity = new InspectionResultEntity();
                entity.setSiteId(siteId);
                entity.setItemId(item.getId());
                entity.setCategoryGroup(newGroupName);
                entity.setResult(null);
                entity.setMemo(null);
                inspectionResultRepo.save(entity);
            }
        }
    }

    public List<PhotoDTO> getPhotosBySiteIdAndItemId(Long siteId, Long itemId, String categoryGroup) {

        Optional<InspectionResultEntity> resultOpt =
                inspectionResultRepo.findFirstBySiteIdAndItemIdAndCategoryGroupOrderByIdDesc(
                        siteId, itemId, categoryGroup
                );

        if (resultOpt.isEmpty()) {
            return new ArrayList<>();
        }

        List<PhotoEntity> list = photoRepo.findByResultId(resultOpt.get().getId());

        List<PhotoDTO> result = new ArrayList<>();

        for (PhotoEntity p : list) {
            PhotoDTO dto = new PhotoDTO();
            dto.setId(p.getId());
            dto.setFile_url(p.getFileUrl());
            result.add(dto);
        }

        return result;
    }

    public InspectionResultDTO getResult(Long siteId, Long itemId, String categoryGroup) {

        return inspectionResultRepo
                .findFirstBySiteIdAndItemIdAndCategoryGroupOrderByIdDesc(
                        siteId, itemId, categoryGroup
                )
                .map(this::toDTO)
                .orElse(null);
    }

    private InspectionResultDTO toDTO(InspectionResultEntity entity) {

        InspectionResultDTO dto = new InspectionResultDTO();

        dto.setId(entity.getId());
        dto.setSite_id(entity.getSiteId());
        dto.setItem_id(entity.getItemId());
        dto.setResult(entity.getResult());
        dto.setMemo(entity.getMemo());
        dto.setCategory_group(entity.getCategoryGroup());
        dto.setCreated_at(entity.getCreatedAt());

        return dto;
    }

    @Transactional
    public void deleteCategoryGroup(Long siteId, String categoryGroup) {
        List<InspectionResultEntity> list = inspectionResultRepo.findBySiteIdAndCategoryGroup(siteId, categoryGroup);

        for (InspectionResultEntity result : list) {
            List<PhotoEntity> photos = photoRepo.findByResultId(result.getId());
            for (PhotoEntity photo : photos) {
                photoRepo.delete(photo);
            }
            inspectionResultRepo.delete(result);
        }
    }
}