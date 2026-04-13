package com.example.bluetechcloud.service;

import com.example.bluetechcloud.entity.InspectionItemEntity;
import com.example.bluetechcloud.entity.InspectionResultEntity;
import com.example.bluetechcloud.entity.PhotoEntity;
import com.example.bluetechcloud.model.SiteDTO;
import com.example.bluetechcloud.repository.InspectionItemRepo;
import com.example.bluetechcloud.repository.InspectionResultRepo;
import com.example.bluetechcloud.repository.PhotoRepo;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class SitePhotoService {

    private final PhotoRepo photoRepo;
    private final InspectionResultRepo resultRepo;
    private final InspectionItemRepo itemRepo;
    private final SiteService siteService;
    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    public void downloadZip(Long siteId, HttpServletResponse response) throws IOException {

        SiteDTO site = siteService.getSite(siteId);
        String zipName = safeZipFileName(site.getSite_name() + "_현장사진.zip");

        response.setContentType("application/zip");
        response.setHeader(
                "Content-Disposition",
                "attachment; filename*=UTF-8''" +
                        URLEncoder.encode(zipName, StandardCharsets.UTF_8).replaceAll("\\+", "%20")
        );

        List<InspectionResultEntity> results = resultRepo.findBySiteId(siteId);

        Map<Long, InspectionResultEntity> resultMap = new HashMap<>();
        for (InspectionResultEntity result : results) {
            resultMap.put(result.getId(), result);
        }

        Map<Long, InspectionItemEntity> itemCache = new HashMap<>();
        List<PhotoEntity> allPhotos = photoRepo.findAll();

        Set<String> createdDirs = new HashSet<>();
        Map<Long, Integer> photoSeqMap = new HashMap<>();

        try (ZipOutputStream zos = new ZipOutputStream(response.getOutputStream())) {

            // =========================
            // 1) 메모 + 해당사항없음
            // =========================
            for (InspectionResultEntity result : results) {

                InspectionItemEntity item = itemCache.computeIfAbsent(
                        result.getItemId(),
                        id -> itemRepo.findById(id)
                                .orElseThrow(() -> new IllegalArgumentException("점검항목 없음: " + id))
                );

                String categoryDir = buildCategoryDir(item);
                String locationName = extractLocationName(result.getCategoryGroup());
                String itemContent = safeZipEntryName(item.getContent());
                String itemLabel = item.getOrderNo() + "." + itemContent;

                String memo = result.getMemo() == null ? "" : result.getMemo().trim();
                String resultValue = result.getResult() == null ? "" : result.getResult().trim();

                boolean isNotApplicable = "해당사항없음".equals(resultValue);
                boolean isNotWritten = "미작성".equals(resultValue);

                // ===== 해당사항없음 → 폴더 =====
                if (isNotApplicable) {
                    String naDir = categoryDir + "/" +
                            safeZipEntryName(itemLabel + "_해당사항없음") + "/";

                    if (createdDirs.add(naDir)) {
                        zos.putNextEntry(new ZipEntry(naDir));
                        zos.closeEntry();
                    }
                    continue;
                }

                if (isNotWritten) continue;
                if (memo.isBlank()) continue;

                // ===== 메모 txt =====
                String txtFileName = safeZipEntryName(locationName + "_" + itemLabel + "_메모.txt");
                String zipPath = categoryDir + "/" + txtFileName;

                String textContent = ""
                        + "대주제: " + item.getCategory() + System.lineSeparator()
                        + "세부점검사항: " + item.getContent() + System.lineSeparator()
                        + "위치명: " + locationName + System.lineSeparator()
                        + "점검결과: " + resultValue + System.lineSeparator()
                        + "메모: " + memo + System.lineSeparator();

                zos.putNextEntry(new ZipEntry(zipPath));
                zos.write(textContent.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }

            // =========================
            // 2) 사진
            // =========================
            for (PhotoEntity photo : allPhotos) {

                InspectionResultEntity result = resultMap.get(photo.getResultId());
                if (result == null) continue;

                InspectionItemEntity item = itemCache.computeIfAbsent(
                        result.getItemId(),
                        id -> itemRepo.findById(id)
                                .orElseThrow(() -> new IllegalArgumentException("점검항목 없음: " + id))
                );

                String categoryDir = buildCategoryDir(item);
                String locationName = extractLocationName(result.getCategoryGroup());
                String itemContent = safeZipEntryName(item.getContent());
                String itemLabel = item.getOrderNo() + "." + itemContent;

                int seq = photoSeqMap.getOrDefault(result.getId(), 0) + 1;
                photoSeqMap.put(result.getId(), seq);

                String fileUrl = photo.getFileUrl();
                String s3Key = extractKeyFromUrl(fileUrl);
                String ext = extractExtension(fileUrl);

                String photoFileName = safeZipEntryName(
                        locationName + "_" + itemLabel + "_" + seq + ext
                );

                String zipPath = categoryDir + "/" + photoFileName;

                GetObjectRequest req = GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(s3Key)
                        .build();

                try (InputStream is = s3Client.getObject(req)) {
                    zos.putNextEntry(new ZipEntry(zipPath));
                    is.transferTo(zos);
                    zos.closeEntry();
                } catch (Exception e) {
                    System.out.println("S3 download fail: " + s3Key);
                    e.printStackTrace();
                }
            }

            zos.finish();
        }
    }

    private String buildCategoryDir(InspectionItemEntity item) {
        int categoryOrder = item.getCategoryOrder();
        if (categoryOrder <= 0) {
            categoryOrder = 999;
        }

        String categoryName = safeZipEntryName(item.getCategory());
        return categoryOrder + "." + categoryName;
    }

    private String buildItemDir(InspectionItemEntity item) {
        int orderNo = item.getOrderNo();
        if (orderNo <= 0) {
            orderNo = 999;
        }

        String content = safeZipEntryName(item.getContent());
        return orderNo + "." + content;
    }

    private String extractLocationName(String categoryGroup) {
        if (categoryGroup == null || categoryGroup.isBlank()) {
            return "위치미정";
        }

        int idx = categoryGroup.indexOf("_");
        if (idx < 0 || idx >= categoryGroup.length() - 1) {
            return "위치미정";
        }

        String location = categoryGroup.substring(idx + 1).trim();
        return location.isBlank() ? "위치미정" : safeZipEntryName(location);
    }

    private String extractExtension(String path) {
        String fileName = path.substring(path.lastIndexOf("/") + 1);
        int dotIdx = fileName.lastIndexOf(".");
        if (dotIdx == -1) {
            return ".jpg";
        }
        return fileName.substring(dotIdx);
    }

    private String extractKeyFromUrl(String fileUrl) {
        String marker = ".amazonaws.com/";
        int idx = fileUrl.indexOf(marker);

        if (idx != -1) {
            return fileUrl.substring(idx + marker.length());
        }
        return fileUrl;
    }

    private String convertResultLabel(String result) {
        return switch (result) {
            case "OK" -> "정상";
            case "NG" -> "이상";
            case "NA" -> "해당없음";
            case "작성" -> "작성";
            default -> result;
        };
    }

    private String safeZipEntryName(String name) {
        if (name == null || name.isBlank()) {
            return "이름없음";
        }
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    private String safeZipFileName(String fileName) {
        return fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
    }
}