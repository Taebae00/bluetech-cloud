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
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ExcelReportService {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    private final SiteService siteService;
    private final InspectionResultRepo inspectionResultRepo;
    private final InspectionItemRepo inspectionItemRepo;
    private final PhotoRepo photoRepo;

    public void downloadPerformanceCheckExcel(Long siteId, HttpServletResponse response) throws IOException {
        SiteDTO site = siteService.getSite(siteId);
        List<InspectionResultEntity> results = inspectionResultRepo.findBySiteId(siteId);
        List<InspectionItemEntity> items = inspectionItemRepo.findAllByOrderByCategoryOrderAscOrderNoAscIdAsc();

        String fileName = safeFileName(site.getSite_name() + "_성능점검보고서.xlsx");

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader(
                "Content-Disposition",
                "attachment; filename*=UTF-8''" +
                        URLEncoder.encode(fileName, StandardCharsets.UTF_8).replaceAll("\\+", "%20")
        );

        try (Workbook wb = new XSSFWorkbook()) {
            Styles styles = createStyles(wb);

            createCoverSheet(wb, styles, site);
            createWorkSummarySheet(wb, styles, site);
            createTargetFacilitySheet(wb, styles, site, items, results);
            createCategorySheets(wb, styles, items, results);

            for (int i = 0; i < wb.getNumberOfSheets(); i++) {
                Sheet sheet = wb.getSheetAt(i);
                String name = sheet.getSheetName();

                if (!name.equals("표지") && !name.equals("업무현황") && !name.equals("대상설비현황")) {
                    continue;
                }

                autoSizeSafe(sheet, 0, 6);
            }

            wb.write(response.getOutputStream());
        }
    }

    private String extractKeyFromUrl(String fileUrl) {
        String prefix = "https://" + bucket + ".s3.ap-northeast-2.amazonaws.com/";
        return fileUrl.replace(prefix, "");
    }

    private String extractLocationName(String categoryGroup) {
        if (categoryGroup == null || !categoryGroup.contains("_")) {
            return "";
        }
        String[] parts = categoryGroup.split("_", 2);
        return parts.length > 1 ? parts[1] : "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean hasMeaningfulResult(String resultValue) {
        String value = safe(resultValue).trim();
        return !value.isEmpty() && !"미작성".equals(value);
    }

    private boolean hasMeaningfulMemo(String memo) {
        return !isBlank(memo);
    }

    private boolean shouldRenderItemBlock(InspectionResultEntity result, List<PhotoEntity> photos) {
        if (result == null) {
            return photos != null && !photos.isEmpty();
        }

        String resultValue = safe(result.getResult()).trim();
        String memo = safe(result.getMemo()).trim();
        boolean hasPhotos = photos != null && !photos.isEmpty();

        return hasMeaningfulResult(resultValue) || hasMeaningfulMemo(memo) || hasPhotos;
    }

    private void applyCategorySheetLayout(Sheet sheet) {
        for (int i = 0; i <= 7; i++) {
            sheet.setColumnWidth(i, 2800);
        }

        sheet.setDisplayGridlines(false);
        sheet.setFitToPage(true);
        sheet.setHorizontallyCenter(true);

        PrintSetup printSetup = sheet.getPrintSetup();
        printSetup.setLandscape(false);
        sheet.setAutobreaks(true);
    }

    private int createItemBlock(
            Sheet sheet,
            Workbook wb,
            Styles styles,
            int startRow,
            InspectionItemEntity item,
            InspectionResultEntity result,
            List<PhotoEntity> photos
    ) {
        String itemTitle = item.getOrderNo() + ". " + safe(item.getContent());
        String locationName = result == null ? "" : extractLocationName(result.getCategoryGroup());
        String resultValue = result == null ? "" : safe(result.getResult());
        String memo = result == null ? "" : safe(result.getMemo());

        // 제목 바
        mergeAndSet(sheet, startRow, startRow, 0, 7, itemTitle, styles.header);
        Row titleRow = sheet.getRow(startRow);
        if (titleRow == null) titleRow = sheet.createRow(startRow);
        titleRow.setHeightInPoints(24);
        startRow++;

        // 위치 / 결과
        Row row1 = sheet.createRow(startRow++);
        row1.setHeightInPoints(22);
        createCell(row1, 0, "위치명", styles.label);
        mergeCellsAndSet(sheet, row1, row1.getRowNum(), 1, 3, locationName, styles.value);
        createCell(row1, 4, "점검결과", styles.label);
        mergeCellsAndSet(sheet, row1, row1.getRowNum(), 5, 7, resultValue, styles.value);

        // 메모
        Row row2 = sheet.createRow(startRow++);
        row2.setHeightInPoints(42);
        createCell(row2, 0, "메모", styles.label);
        mergeCellsAndSet(sheet, row2, row2.getRowNum(), 1, 7, memo, styles.value);

        // 사진 제목
        mergeAndSet(sheet, startRow, startRow, 0, 7, "점검 사진", styles.tableHeader);
        Row photoTitleRow = sheet.getRow(startRow);
        if (photoTitleRow == null) photoTitleRow = sheet.createRow(startRow);
        photoTitleRow.setHeightInPoints(22);
        startRow++;

        // 사진 없으면 안내문
        if (photos == null || photos.isEmpty()) {
            mergeAndSet(sheet, startRow, startRow, 0, 7, "첨부된 사진 없음", styles.note);
            Row noPhotoRow = sheet.getRow(startRow);
            if (noPhotoRow == null) noPhotoRow = sheet.createRow(startRow);
            noPhotoRow.setHeightInPoints(24);
            startRow += 2;
            return startRow;
        }

        // 사진 2장씩 넓게 배치
        int photoIndex = 0;
        while (photoIndex < photos.size()) {
            for (int r = 0; r < 12; r++) {
                Row imgRow = sheet.getRow(startRow + r);
                if (imgRow == null) imgRow = sheet.createRow(startRow + r);
                imgRow.setHeightInPoints(18);
            }

            insertPhoto(sheet, wb, photos.get(photoIndex), startRow, startRow + 11, 0, 4);
            photoIndex++;

            if (photoIndex < photos.size()) {
                insertPhoto(sheet, wb, photos.get(photoIndex), startRow, startRow + 11, 4, 8);
                photoIndex++;
            }

            startRow += 12;
        }

        startRow += 2;
        return startRow;
    }

    private void mergeCellsAndSet(Sheet sheet, Row row, int rowIndex, int firstCol, int lastCol, String text, CellStyle style) {
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, firstCol, lastCol));
        Cell cell = row.createCell(firstCol);
        cell.setCellValue(text == null ? "" : text);
        cell.setCellStyle(style);

        for (int i = firstCol + 1; i <= lastCol; i++) {
            Cell extra = row.createCell(i);
            extra.setCellStyle(style);
        }
    }

    private void insertPhoto(Sheet sheet, Workbook wb, PhotoEntity photo,
                             int row1, int row2, int col1, int col2) {
        try {
            String fileUrl = photo.getFileUrl();
            String s3Key = extractKeyFromUrl(fileUrl);

            GetObjectRequest req = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(s3Key)
                    .build();

            byte[] bytes;
            try (InputStream is = s3Client.getObject(req)) {
                bytes = is.readAllBytes();
            }

            int pictureType = Workbook.PICTURE_TYPE_JPEG;
            String lower = fileUrl.toLowerCase();
            if (lower.endsWith(".png")) {
                pictureType = Workbook.PICTURE_TYPE_PNG;
            }

            int pictureIdx = wb.addPicture(bytes, pictureType);
            Drawing<?> drawing = sheet.createDrawingPatriarch();
            CreationHelper helper = wb.getCreationHelper();
            ClientAnchor anchor = helper.createClientAnchor();

            anchor.setRow1(row1);
            anchor.setRow2(row2);
            anchor.setCol1(col1);
            anchor.setCol2(col2);

            Picture pict = drawing.createPicture(anchor, pictureIdx);
            pict.resize(0.95);
        } catch (Exception e) {
            System.out.println("엑셀 사진 삽입 실패: " + photo.getFileUrl());
            e.printStackTrace();
        }
    }

    private void createCoverSheet(Workbook wb, Styles styles, SiteDTO site) {
        Sheet sheet = wb.createSheet("표지");
        setColumnWidths(sheet, 0, 0, 6000);
        setColumnWidths(sheet, 1, 1, 6000);
        setColumnWidths(sheet, 2, 2, 6000);
        setColumnWidths(sheet, 3, 3, 6000);

        mergeAndSet(sheet, 1, 1, 0, 3, "정보통신설비 성능점검 보고서", styles.title);
        mergeAndSet(sheet, 3, 3, 0, 3, site.getSite_name(), styles.subtitle);
        mergeAndSet(sheet, 5, 5, 0, 3, "Bluetech-Cloud 자동 생성본", styles.normalCenter);
    }

    private void createWorkSummarySheet(Workbook wb, Styles styles, SiteDTO site) {
        Sheet sheet = wb.createSheet("업무현황");
        setColumnWidths(sheet, 0, 0, 5000);
        setColumnWidths(sheet, 1, 1, 9000);
        setColumnWidths(sheet, 2, 2, 5000);
        setColumnWidths(sheet, 3, 3, 9000);

        int rowIdx = 0;

        mergeAndSet(sheet, rowIdx, rowIdx, 0, 3, "정보통신설비 성능점검 업무 현황", styles.header);
        rowIdx += 2;

        createKeyValueRow(sheet, rowIdx++, styles, "현장명", safe(site.getSite_name()), "점검유형", "");
        createKeyValueRow(sheet, rowIdx++, styles, "현장주소", "", "점검일", safe(site.getWork_date() == null ? "" : site.getWork_date().toString()));
        createKeyValueRow(sheet, rowIdx++, styles, "관리주체", "", "연락처", "");
        createKeyValueRow(sheet, rowIdx++, styles, "점검업체", "㈜푸른기술플러스", "비고", "");
    }

    private void createTargetFacilitySheet(
            Workbook wb,
            Styles styles,
            SiteDTO site,
            List<InspectionItemEntity> items,
            List<InspectionResultEntity> results
    ) {
        Sheet sheet = wb.createSheet("대상설비현황");

        setColumnWidths(sheet, 0, 0, 8000);
        setColumnWidths(sheet, 1, 1, 4000);
        setColumnWidths(sheet, 2, 2, 4000);
        setColumnWidths(sheet, 3, 3, 8000);
        setColumnWidths(sheet, 4, 4, 4000);
        setColumnWidths(sheet, 5, 5, 4000);

        int rowIdx = 0;
        mergeAndSet(sheet, rowIdx, rowIdx, 0, 5, "정보통신설비 성능점검 대상 현황표", styles.header);
        rowIdx += 2;

        Row header = sheet.createRow(rowIdx++);
        createCell(header, 0, "대상설비", styles.tableHeader);
        createCell(header, 1, "대상", styles.tableHeader);
        createCell(header, 2, "점검결과", styles.tableHeader);
        createCell(header, 3, "대상설비", styles.tableHeader);
        createCell(header, 4, "대상", styles.tableHeader);
        createCell(header, 5, "점검결과", styles.tableHeader);

        List<String> categories = extractOrderedCategories(items);
        List<String> left = new ArrayList<>();
        List<String> right = new ArrayList<>();

        for (int i = 0; i < categories.size(); i++) {
            if (i % 2 == 0) left.add(categories.get(i));
            else right.add(categories.get(i));
        }

        int max = Math.max(left.size(), right.size());
        for (int i = 0; i < max; i++) {
            Row row = sheet.createRow(rowIdx++);

            if (i < left.size()) {
                String category = left.get(i);
                createCell(row, 0, category, styles.tableCell);
                createCell(row, 1, isTargetCategory(items, category) ? "[○]" : "[ ]", styles.tableCellCenter);
                createCell(row, 2, summarizeCategoryResult(results, items, category), styles.tableCellCenter);
            } else {
                createCell(row, 0, "", styles.tableCell);
                createCell(row, 1, "", styles.tableCellCenter);
                createCell(row, 2, "", styles.tableCellCenter);
            }

            if (i < right.size()) {
                String category = right.get(i);
                createCell(row, 3, category, styles.tableCell);
                createCell(row, 4, isTargetCategory(items, category) ? "[○]" : "[ ]", styles.tableCellCenter);
                createCell(row, 5, summarizeCategoryResult(results, items, category), styles.tableCellCenter);
            } else {
                createCell(row, 3, "", styles.tableCell);
                createCell(row, 4, "", styles.tableCellCenter);
                createCell(row, 5, "", styles.tableCellCenter);
            }
        }
    }

    private void createCategorySheets(
            Workbook wb,
            Styles styles,
            List<InspectionItemEntity> items,
            List<InspectionResultEntity> results
    ) {
        Map<String, List<InspectionItemEntity>> grouped = new LinkedHashMap<>();
        for (InspectionItemEntity item : items) {
            grouped.computeIfAbsent(item.getCategory(), k -> new ArrayList<>()).add(item);
        }

        Map<Long, List<InspectionResultEntity>> resultsByItemId = new HashMap<>();
        for (InspectionResultEntity result : results) {
            resultsByItemId.computeIfAbsent(result.getItemId(), k -> new ArrayList<>()).add(result);
        }

        for (Map.Entry<String, List<InspectionItemEntity>> entry : grouped.entrySet()) {
            String category = entry.getKey();
            List<InspectionItemEntity> categoryItems = entry.getValue();

            Sheet sheet = wb.createSheet(trimSheetName(category));
            applyCategorySheetLayout(sheet);

            int rowIdx = 0;
            boolean hasRenderedAnyBlock = false;

            mergeAndSet(sheet, rowIdx, rowIdx, 0, 7, "<" + category + " 성능점검표>", styles.header);
            rowIdx += 2;

            for (InspectionItemEntity item : categoryItems) {
                List<InspectionResultEntity> itemResults =
                        resultsByItemId.getOrDefault(item.getId(), Collections.emptyList());

                if (itemResults.isEmpty()) {
                    continue;
                }

                Map<String, List<InspectionResultEntity>> byGroup = new LinkedHashMap<>();
                for (InspectionResultEntity result : itemResults) {
                    String key = safe(result.getCategoryGroup());
                    byGroup.computeIfAbsent(key, k -> new ArrayList<>()).add(result);
                }

                for (Map.Entry<String, List<InspectionResultEntity>> groupEntry : byGroup.entrySet()) {
                    InspectionResultEntity latest = groupEntry.getValue().get(groupEntry.getValue().size() - 1);
                    List<PhotoEntity> photos = photoRepo.findByResultId(latest.getId());

                    if (!shouldRenderItemBlock(latest, photos)) {
                        continue;
                    }

                    rowIdx = createItemBlock(sheet, wb, styles, rowIdx, item, latest, photos);
                    hasRenderedAnyBlock = true;
                }
            }

            if (!hasRenderedAnyBlock) {
                mergeAndSet(sheet, rowIdx, rowIdx, 0, 7, "출력할 점검 내용이 없습니다.", styles.note);
            }
        }
    }

    private List<String> extractOrderedCategories(List<InspectionItemEntity> items) {
        LinkedHashMap<String, Integer> ordered = new LinkedHashMap<>();
        for (InspectionItemEntity item : items) {
            ordered.putIfAbsent(item.getCategory(), item.getCategoryOrder());
        }
        return new ArrayList<>(ordered.keySet());
    }

    private boolean isTargetCategory(List<InspectionItemEntity> items, String category) {
        return items.stream().anyMatch(i -> Objects.equals(i.getCategory(), category));
    }

    private String summarizeCategoryResult(
            List<InspectionResultEntity> results,
            List<InspectionItemEntity> items,
            String category
    ) {
        Set<Long> itemIds = new HashSet<>();
        for (InspectionItemEntity item : items) {
            if (Objects.equals(item.getCategory(), category)) {
                itemIds.add(item.getId());
            }
        }

        boolean hasWritten = false;
        boolean hasNA = false;
        boolean hasFail = false;

        for (InspectionResultEntity result : results) {
            if (!itemIds.contains(result.getItemId())) continue;

            String value = safe(result.getResult()).trim();
            if ("작성".equals(value)) hasWritten = true;
            if ("해당사항없음".equals(value)) hasNA = true;
            if ("부적합".equals(value) || "이상".equals(value)) hasFail = true;
        }

        if (hasFail) return "X";
        if (hasWritten) return "○";
        if (hasNA) return "-";
        return "";
    }

    private void createKeyValueRow(Sheet sheet, int rowIndex, Styles styles,
                                   String key1, String value1, String key2, String value2) {
        Row row = sheet.createRow(rowIndex);
        createCell(row, 0, key1, styles.label);
        createCell(row, 1, value1, styles.value);
        createCell(row, 2, key2, styles.label);
        createCell(row, 3, value2, styles.value);
    }

    private void mergeAndSet(Sheet sheet, int firstRow, int lastRow, int firstCol, int lastCol,
                             String text, CellStyle style) {
        sheet.addMergedRegion(new CellRangeAddress(firstRow, lastRow, firstCol, lastCol));
        Row row = sheet.getRow(firstRow);
        if (row == null) row = sheet.createRow(firstRow);
        Cell cell = row.createCell(firstCol);
        cell.setCellValue(text == null ? "" : text);
        cell.setCellStyle(style);

        for (int c = firstCol + 1; c <= lastCol; c++) {
            Cell extra = row.getCell(c);
            if (extra == null) extra = row.createCell(c);
            extra.setCellStyle(style);
        }
    }

    private void createCell(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private void setColumnWidths(Sheet sheet, int fromCol, int toCol, int width) {
        for (int i = fromCol; i <= toCol; i++) {
            sheet.setColumnWidth(i, width);
        }
    }

    private void autoSizeSafe(Sheet sheet, int fromCol, int toCol) {
        for (int i = fromCol; i <= toCol; i++) {
            try {
                sheet.autoSizeColumn(i);
                int current = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.min(current + 800, 20000));
            } catch (Exception ignored) {
            }
        }
    }

    private String trimSheetName(String name) {
        String safe = safe(name);
        safe = safe.replaceAll("[\\\\/*\\[\\]:?]", "_");
        return safe.length() > 31 ? safe.substring(0, 31) : safe;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String safeFileName(String fileName) {
        return fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private Styles createStyles(Workbook wb) {
        Styles s = new Styles();

        Font titleFont = wb.createFont();
        titleFont.setFontHeightInPoints((short) 20);
        titleFont.setBold(true);

        Font headerFont = wb.createFont();
        headerFont.setFontHeightInPoints((short) 12);
        headerFont.setBold(true);

        Font normalFont = wb.createFont();
        normalFont.setFontHeightInPoints((short) 10);

        s.title = wb.createCellStyle();
        s.title.setAlignment(HorizontalAlignment.CENTER);
        s.title.setVerticalAlignment(VerticalAlignment.CENTER);
        s.title.setFont(titleFont);

        s.subtitle = wb.createCellStyle();
        s.subtitle.setAlignment(HorizontalAlignment.CENTER);
        s.subtitle.setVerticalAlignment(VerticalAlignment.CENTER);
        s.subtitle.setFont(headerFont);

        s.header = createBorderStyle(wb, headerFont, IndexedColors.GREY_25_PERCENT.getIndex(), HorizontalAlignment.CENTER);
        s.label = createBorderStyle(wb, headerFont, IndexedColors.LEMON_CHIFFON.getIndex(), HorizontalAlignment.CENTER);
        s.value = createBorderStyle(wb, normalFont, IndexedColors.WHITE.getIndex(), HorizontalAlignment.LEFT);
        s.tableHeader = createBorderStyle(wb, headerFont, IndexedColors.GREY_25_PERCENT.getIndex(), HorizontalAlignment.CENTER);
        s.tableCell = createBorderStyle(wb, normalFont, IndexedColors.WHITE.getIndex(), HorizontalAlignment.LEFT);
        s.tableCellCenter = createBorderStyle(wb, normalFont, IndexedColors.WHITE.getIndex(), HorizontalAlignment.CENTER);
        s.note = createBorderStyle(wb, normalFont, IndexedColors.WHITE.getIndex(), HorizontalAlignment.LEFT);
        s.normalCenter = createBorderStyle(wb, normalFont, IndexedColors.WHITE.getIndex(), HorizontalAlignment.CENTER);

        s.value.setWrapText(true);
        s.tableCell.setWrapText(true);
        s.note.setWrapText(true);

        return s;
    }

    private CellStyle createBorderStyle(Workbook wb, Font font, short bgColor, HorizontalAlignment align) {
        CellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setFillForegroundColor(bgColor);
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private static class Styles {
        CellStyle title;
        CellStyle subtitle;
        CellStyle header;
        CellStyle label;
        CellStyle value;
        CellStyle tableHeader;
        CellStyle tableCell;
        CellStyle tableCellCenter;
        CellStyle note;
        CellStyle normalCenter;
    }
}