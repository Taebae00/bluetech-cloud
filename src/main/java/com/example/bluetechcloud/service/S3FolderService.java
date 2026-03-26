package com.example.bluetechcloud.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.List;

@Service
@RequiredArgsConstructor
public class S3FolderService {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    public void createSiteCategoryFolders(Long siteId, List<String> categoryNames) {
        for (String categoryName : categoryNames) {
            String safeCategoryName = sanitizeCategoryName(categoryName);
            String key = "sites/" + siteId + "/" + safeCategoryName + "/.keep";

            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType("text/plain")
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(new byte[0]));
        }
    }

    private String sanitizeCategoryName(String categoryName) {
        return categoryName.replaceAll("\\s+", "")
                .replaceAll("[()]", "")
                .replaceAll("[/\\\\]", "-");
    }

}