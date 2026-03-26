package com.example.bluetechcloud.controller;

import com.example.bluetechcloud.entity.InspectionResultEntity;
import com.example.bluetechcloud.entity.PhotoEntity;
import com.example.bluetechcloud.model.*;
import com.example.bluetechcloud.repository.InspectionItemRepo;
import com.example.bluetechcloud.repository.PhotoRepo;
import com.example.bluetechcloud.service.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@Controller
public class MainController {

    private final UserService userService;
    private final SiteService siteService;
    private final InspectionItemService inspectionItemService;
    private final InspectionResultService inspectionResultService;
    private final InspectionItemRepo inspectionItemRepo;
    private final PhotoRepo photoRepo;
    private final SitePhotoService sitePhotoService;

    public MainController(UserService userService, SiteService siteService,
                          InspectionItemService inspectionItemService,
                          InspectionResultService inspectionResultService,
                          FileService fileService, InspectionItemRepo inspectionItemRepo, PhotoRepo photoRepo,
                          SitePhotoService sitePhotoService) {
        this.userService = userService;
        this.siteService = siteService;
        this.inspectionItemService = inspectionItemService;
        this.inspectionResultService = inspectionResultService;
        this.inspectionItemRepo = inspectionItemRepo;
        this.photoRepo = photoRepo;
        this.sitePhotoService = sitePhotoService;
    }

    // 🔥 공통 로그인 체크
    private UserDTO checkLogin(HttpSession session) {
        UserDTO user = (UserDTO) session.getAttribute("user");

        if (user == null) {
            return null;
        }

        return user;
    }

    @GetMapping("/")
    public String Main(){
        return "main";
    }

    @PostMapping("/loginCheck")
    @ResponseBody
    public Object loginCheck(String id, String password, HttpSession session) {

        UserDTO dto = userService.loginCheck(id, password);

        if(dto == null) {
            return 0;
        }

        session.setAttribute("user", dto);
        return dto;
    }

    @GetMapping("/loginOk")
    public String loginOk(HttpSession session, Model model){

        UserDTO user = checkLogin(session);
        if (user == null) {
            return "main";
        }

        List<SiteDTO> list = siteService.getList(user.getId());
        model.addAttribute("list", list);

        return "siteList";
    }

    @PostMapping("/site/add")
    @ResponseBody
    public Object addSite(String siteName, HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return "login";
        }

        return siteService.addSite(siteName, user.getId());
    }

    @GetMapping("/site/write/{siteId}")
    public String writePage(@PathVariable Long siteId, Model model, HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return "main";
        }

        model.addAttribute("loginUser", user);

        SiteDTO site = siteService.getSite(siteId);
        model.addAttribute("site", site);
        model.addAttribute("siteId", siteId);

        Map<String, List<InspectionItemDTO>> baseGroupedItems = inspectionItemService.getGroupedItems();
        List<InspectionResultDTO> resultList = inspectionResultService.getResultsBySiteId(siteId);

        Map<String, Boolean> completedMap = new HashMap<>();
        Map<String, String> resultValueMap = new HashMap<>();
        Map<String, List<Map<String, Object>>> locationViewMap = new LinkedHashMap<>();

        for (String baseCategory : baseGroupedItems.keySet()) {
            locationViewMap.put(baseCategory, new ArrayList<>());
        }

        Map<String, Set<String>> tempGroupSetMap = new LinkedHashMap<>();
        for (String baseCategory : baseGroupedItems.keySet()) {
            tempGroupSetMap.put(baseCategory, new LinkedHashSet<>());
        }

        for (InspectionResultDTO result : resultList) {
            String group = result.getCategory_group();

            if (group == null || group.isBlank()) continue;

            group = group.trim();

            int idx = group.indexOf("_");
            if (idx < 0) continue;

            String baseCategory = group.substring(0, idx).trim();
            String locationName = group.substring(idx + 1).trim();

            if (baseCategory.isBlank()) continue;
            if (locationName.isBlank()) locationName = "전체";

            if (!tempGroupSetMap.containsKey(baseCategory)) continue;

            tempGroupSetMap.get(baseCategory).add(group);

            String key = group + "_" + result.getItem_id();
            String resultValue = result.getResult() == null ? "" : result.getResult().trim();

            if ("작성".equals(resultValue) || "해당사항없음".equals(resultValue)) {
                completedMap.put(key, true);
            }

            resultValueMap.put(key, resultValue);
        }

        int siteTotalCount = baseGroupedItems.size();
        int siteCompletedCount = 0;

        for (Map.Entry<String, List<InspectionItemDTO>> entry : baseGroupedItems.entrySet()) {
            String baseCategory = entry.getKey();
            List<InspectionItemDTO> items = entry.getValue();
            Set<String> groups = tempGroupSetMap.getOrDefault(baseCategory, new LinkedHashSet<>());

            boolean allLocationsDone = !groups.isEmpty();

            for (String groupName : groups) {
                int idx = groupName.indexOf("_");
                String locationName = idx >= 0 && idx < groupName.length() - 1
                        ? groupName.substring(idx + 1).trim()
                        : "전체";

                if (locationName.isBlank()) {
                    locationName = "전체";
                }

                int total = items.size();
                int completed = 0;

                for (InspectionItemDTO item : items) {
                    String key = groupName + "_" + item.getId();
                    if (Boolean.TRUE.equals(completedMap.get(key))) {
                        completed++;
                    }
                }

                Map<String, Object> locationInfo = new HashMap<>();
                locationInfo.put("groupName", groupName);
                locationInfo.put("locationName", locationName);
                locationInfo.put("completed", completed);
                locationInfo.put("total", total);

                locationViewMap.get(baseCategory).add(locationInfo);

                if (!(total > 0 && completed == total)) {
                    allLocationsDone = false;
                }
            }

            if (allLocationsDone) {
                siteCompletedCount++;
            }
        }

        model.addAttribute("baseGroupedItems", baseGroupedItems);
        model.addAttribute("locationViewMap", locationViewMap);
        model.addAttribute("completedMap", completedMap);
        model.addAttribute("resultValueMap", resultValueMap);
        model.addAttribute("siteCompletedCount", siteCompletedCount);
        model.addAttribute("siteTotalCount", siteTotalCount);

        return "siteWrite";
    }

    @PostMapping("/inspection/save")
    @ResponseBody
    public ResponseEntity<?> saveInspection(@RequestParam Long siteId,
                                            @RequestParam Long itemId,
                                            @RequestParam String categoryGroup,
                                            @RequestParam String result,
                                            @RequestParam(required = false) String memo,
                                            @RequestParam(required = false) List<MultipartFile> photos,
                                            HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return ResponseEntity.status(401).body("로그인 필요");
        }

        inspectionResultService.saveInspection(siteId, itemId, categoryGroup, result, memo, photos);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/inspection/photos")
    @ResponseBody
    public Object getPhotos(@RequestParam Long siteId,
                            @RequestParam Long itemId,
                            @RequestParam String categoryGroup,
                            HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return "login";
        }

        return inspectionResultService.getPhotosBySiteIdAndItemId(siteId, itemId, categoryGroup);
    }

    @PostMapping("/site/delete")
    @ResponseBody
    public String deleteSite(@RequestParam Long siteId,
                             HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return "login";
        }

        siteService.deleteSite(siteId);
        return "ok";
    }

    @GetMapping("/site/{siteId}/download")
    public void download(@PathVariable Long siteId,
                         HttpServletResponse response,
                         HttpSession session) throws IOException {

        UserDTO user = checkLogin(session);
        if (user == null) {
            response.sendRedirect("/");
            return;
        }

        sitePhotoService.downloadZip(siteId, response);
    }

    @GetMapping("/inspection/detail")
    @ResponseBody
    public Map<String, Object> getInspectionDetail(@RequestParam Long siteId,
                                                   @RequestParam Long itemId,
                                                   @RequestParam String categoryGroup) {

        Map<String, Object> resultMap = new HashMap<>();

        InspectionResultEntity resultEntity =
                inspectionResultService.getInspectionResult(siteId, itemId, categoryGroup);

        if (resultEntity == null) {
            resultMap.put("memo", "");
            resultMap.put("photos", new ArrayList<>());
            return resultMap;
        }

        List<PhotoEntity> photoList = photoRepo.findByResultId(resultEntity.getId());

        List<Map<String, Object>> photos = photoList.stream().map(photo -> {
            Map<String, Object> photoMap = new HashMap<>();
            photoMap.put("id", photo.getId());
            photoMap.put("fileUrl", photo.getFileUrl());
            return photoMap;
        }).toList();

        resultMap.put("memo", resultEntity.getMemo());
        resultMap.put("photos", photos);

        return resultMap;
    }

    @PostMapping("/inspection/photo/delete")
    @ResponseBody
    public ResponseEntity<?> deletePhoto(@RequestParam Long photoId,
                                         HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return ResponseEntity.status(401).body("로그인 필요");
        }

        inspectionResultService.deletePhoto(photoId);

        return ResponseEntity.ok().build();
    }

    @PostMapping("/inspection-item/custom/add")
    @ResponseBody
    public ResponseEntity<?> addCustomInspectionItem(@RequestParam String categoryName,
                                                     @RequestParam String content,
                                                     HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return ResponseEntity.status(401).body("로그인 필요");
        }

        InspectionItemDTO dto = inspectionItemService.addCustomItem(categoryName, content);

        return ResponseEntity.ok(dto);
    }

    @PostMapping("/category/add")
    @ResponseBody
    public Map<String, Object> addCategoryGroup(@RequestParam Long siteId,
                                                @RequestParam String templateCategory,
                                                @RequestParam String newCategoryName,
                                                HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            throw new RuntimeException("로그인이 필요합니다.");
        }

        inspectionResultService.addCategoryGroup(siteId, templateCategory, newCategoryName);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("groupName", templateCategory + "_" + newCategoryName.trim());
        result.put("locationName", newCategoryName.trim());

        // 핵심: 해당 대주제의 점검항목들 같이 내려주기
        Map<String, List<InspectionItemDTO>> groupedItems = inspectionItemService.getGroupedItems();
        List<InspectionItemDTO> items = groupedItems.getOrDefault(templateCategory, new ArrayList<>());
        result.put("items", items);

        return result;
    }

    @PostMapping("/category/delete")
    @ResponseBody
    public String deleteCategoryGroup(@RequestParam Long siteId,
                                      @RequestParam String categoryGroup,
                                      HttpSession session) {

        UserDTO user = checkLogin(session);
        if (user == null) {
            return "login";
        }

        inspectionResultService.deleteCategoryGroup(siteId, categoryGroup);
        return "ok";
    }

    @PostMapping("/logout")
    @ResponseBody
    public String logout(HttpSession session) {
        session.invalidate();
        return "ok";
    }
}