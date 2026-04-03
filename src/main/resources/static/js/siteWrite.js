function toggleCategory(button) {
    const box = button.closest(".category-box");
    const inner = box.querySelector(".category-inner");
    const isOpen = inner.classList.contains("open");

    document.querySelectorAll(".category-inner.open").forEach(el => {
        el.classList.remove("open");
    });

    if (!isOpen && inner) {
        inner.classList.add("open");
    }
}

function updateCategoryLocationCount(categoryBox) {
    if (!categoryBox) return;

    const titleSpan = categoryBox.querySelector(".category-title span");
    if (!titleSpan) return;

    const locationCount = categoryBox.querySelectorAll(".location-box").length;
    const currentText = titleSpan.textContent.trim();
    const baseText = currentText.replace(/\s*\(\d+\)\s*$/, "").trim();

    titleSpan.textContent = `${baseText} (${locationCount})`;
}

function updateAllCategoryLocationCounts() {
    document.querySelectorAll(".category-box").forEach(categoryBox => {
        updateCategoryLocationCount(categoryBox);
    });
}

function updateLocationProgress(locationBox) {
    if (!locationBox) return;

    const total = locationBox.querySelectorAll(".item-row").length;
    const completed = Array.from(locationBox.querySelectorAll(".item-card"))
        .filter(card => {
            const val = card.dataset.currentResult || "미작성";
            return val === "작성" || val === "해당사항없음";
        }).length;

    const progress = locationBox.querySelector(".location-progress");
    if (progress) {
        progress.textContent = `${completed}/${total}`;
    }
}

function syncStatusButton(itemCard) {
    if (!itemCard) return;

    const statusBtn = itemCard.querySelector(".status-default-btn");
    if (!statusBtn) return;

    const currentResult = itemCard.dataset.currentResult || "미작성";

    if (currentResult === "작성") {
        statusBtn.textContent = "작성";
        statusBtn.style.backgroundColor = "#16a34a";
        statusBtn.style.color = "#ffffff";
        statusBtn.style.borderColor = "#16a34a";
    } else {
        statusBtn.textContent = "미작성";
        statusBtn.style.backgroundColor = "";
        statusBtn.style.color = "";
        statusBtn.style.borderColor = "";
    }
}

function recalcSiteProgress() {
    const siteNameBox = document.querySelector(".site-name");
    const categoryBoxes = document.querySelectorAll(".category-box");

    let siteCompleted = 0;
    const siteTotal = categoryBoxes.length;

    categoryBoxes.forEach(categoryBox => {
        const hasAnyInputInCategory = Array.from(categoryBox.querySelectorAll(".item-card"))
            .some(itemCard => {
                const val = itemCard.dataset.currentResult || "미작성";
                return val === "작성" || val === "해당사항없음";
            });

        if (hasAnyInputInCategory) {
            siteCompleted++;
        }
    });

    if (siteNameBox) {
        const siteTitle = document.querySelector(".page-title")
            ?.textContent?.replace(" 현장 점검 작성", "") || "현장";

        siteNameBox.textContent = `${siteTitle} 현장 (${siteCompleted}/${siteTotal})`;
    }
}

function toggleLocation(button) {
    const locationBox = button.closest(".location-box");
    const itemList = locationBox.querySelector(".item-list");
    const isOpen = itemList.classList.contains("open");

    const locationList = locationBox.closest(".location-list");
    if (locationList) {
        locationList.querySelectorAll(".item-list.open").forEach(el => {
            el.classList.remove("open");
        });
    }

    if (!isOpen && itemList) {
        itemList.classList.add("open");
    }
}

function toggleItemEditor(button) {
    const card = button.closest(".item-card");
    const editor = card.querySelector(".item-editor");
    const isOpen = editor.classList.contains("open");

    document.querySelectorAll(".item-editor.open").forEach(el => {
        el.classList.remove("open");
    });

    if (!isOpen) {
        editor.classList.add("open");
        loadInlineInspectionData(button, editor);
    }
}

function addLocation(button) {
    const siteId = $("#siteId").val();
    const templateCategory = button.dataset.templateCategory;
    const categoryBox = button.closest(".category-box");
    const input = categoryBox.querySelector(".location-name-input");
    const newLocationName = input.value.trim();

    if (!newLocationName) {
        alert("위치명을 입력해주세요.");
        return;
    }

    if (newLocationName.includes("_")) {
        alert("위치명에는 _ 문자를 사용할 수 없습니다.");
        return;
    }

    $.ajax({
        type: "POST",
        url: "/category/add",
        data: {
            siteId,
            templateCategory,
            newCategoryName: newLocationName
        },
        success: function () {
            $.ajax({
                type: "GET",
                url: "/category/location-list",
                data: {
                    siteId,
                    categoryName: templateCategory
                },
                success: function (html) {
                    const oldList = categoryBox.querySelector(".location-list");
                    const categoryInner = categoryBox.querySelector(".category-inner");
                    const addBox = categoryInner.querySelector(".location-add-box");

                    if (oldList) {
                        oldList.outerHTML = html;
                    } else {
                        addBox.insertAdjacentHTML("afterend", html);
                    }

                    input.value = "";

                    categoryBox.querySelectorAll(".item-editor").forEach(bindMemoAutoWrite);
                    categoryBox.querySelectorAll(".photo-slot").forEach(bindInlinePhotoSlot);
                    categoryBox.querySelectorAll(".item-card").forEach(syncStatusButton);

                    updateCategoryLocationCount(categoryBox);
                    recalcSiteProgress();
                },
                error: function (xhr) {
                    console.error(xhr.responseText);
                    alert("위치 목록 갱신 실패");
                }
            });
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert("위치 추가 실패");
        }
    });
}

function deleteLocation(button) {
    const siteId = $("#siteId").val();
    const categoryGroup = button.dataset.categoryGroup;

    if (!confirm("이 위치를 삭제할까요?")) return;

    $.ajax({
        type: "POST",
        url: "/category/delete",
        data: { siteId, categoryGroup },
        success: function () {
            alert("삭제되었습니다.");

            const locationBox = button.closest(".location-box");
            const categoryBox = button.closest(".category-box");

            if (locationBox) {
                locationBox.remove();
            }

            updateCategoryLocationCount(categoryBox);
            recalcSiteProgress();
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert("위치 삭제 실패");
        }
    });
}

function triggerInlinePhotoInput(slot) {
    const input = slot.querySelector(".inline-photo-input");
    if (input) input.click();
}

function bindInlinePhotoSlot(slot) {
    const input = slot.querySelector(".inline-photo-input");
    const img = slot.querySelector(".photo-slot-img");
    const text = slot.querySelector(".photo-slot-text");
    const delBtn = slot.querySelector(".photo-delete-btn");

    if (!input) return;

    input.onchange = function () {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            img.src = e.target.result;
            img.style.display = "block";
            text.style.display = "none";
            delBtn.style.display = "flex";
            slot.classList.remove("empty");
            slot.classList.add("filled");
            delete slot.dataset.savedPhotoId;
        };
        reader.readAsDataURL(file);
    };
}

function removeInlinePhoto(event, button) {
    event.stopPropagation();

    const slot = button.closest(".photo-slot");
    const savedPhotoId = slot.dataset.savedPhotoId;

    if (savedPhotoId) {
        $.ajax({
            type: "POST",
            url: "/inspection/photo/delete",
            data: { photoId: savedPhotoId },
            success: function () {
                clearInlineSlot(slot);
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("사진 삭제 실패");
            }
        });
    } else {
        clearInlineSlot(slot);
    }
}

function clearInlineSlot(slot) {
    const input = slot.querySelector(".inline-photo-input");
    const img = slot.querySelector(".photo-slot-img");
    const text = slot.querySelector(".photo-slot-text");
    const delBtn = slot.querySelector(".photo-delete-btn");

    if (input) input.value = "";
    if (img) {
        img.src = "";
        img.style.display = "none";
    }
    if (text) text.style.display = "block";
    if (delBtn) delBtn.style.display = "none";

    slot.classList.add("empty");
    slot.classList.remove("filled");
    delete slot.dataset.savedPhotoId;
}

function addInlinePhotoSlot(button) {
    const editor = button.closest(".item-editor");
    const grid = editor.querySelector(".editor-photo-grid");

    const div = document.createElement("div");
    div.className = "photo-slot empty";
    div.innerHTML = `
        <span class="photo-slot-text">+ 현장사진</span>
        <img class="photo-slot-img" style="display:none;">
        <input type="file" class="inline-photo-input" accept="image/*" capture="environment" style="display:none;">
        <button type="button" class="photo-delete-btn" style="display:none;" onclick="removeInlinePhoto(event, this)">×</button>
    `;
    div.onclick = function () { triggerInlinePhotoInput(div); };

    grid.appendChild(div);
    bindInlinePhotoSlot(div);
}

function renderSavedPhotos(editor, photos) {
    const grid = editor.querySelector(".editor-photo-grid");
    if (!grid) return;

    const slots = Array.from(grid.querySelectorAll(".photo-slot"));
    const list = photos || [];

    while (slots.length < Math.max(2, list.length)) {
        const div = document.createElement("div");
        div.className = "photo-slot empty";
        div.innerHTML = `
            <span class="photo-slot-text">+ 현장사진</span>
            <img class="photo-slot-img" style="display:none;">
            <input type="file" class="inline-photo-input" accept="image/*" capture="environment" style="display:none;">
            <button type="button" class="photo-delete-btn" style="display:none;" onclick="removeInlinePhoto(event, this)">×</button>
        `;
        div.onclick = function () { triggerInlinePhotoInput(div); };
        grid.appendChild(div);
        bindInlinePhotoSlot(div);
        slots.push(div);
    }

    slots.forEach(slot => clearInlineSlot(slot));

    list.forEach((photo, index) => {
        const slot = slots[index];
        const img = slot.querySelector(".photo-slot-img");
        const text = slot.querySelector(".photo-slot-text");
        const delBtn = slot.querySelector(".photo-delete-btn");

        img.src = photo.fileUrl || photo.file_url || photo.url || "";
        img.style.display = "block";
        text.style.display = "none";
        delBtn.style.display = "flex";
        slot.classList.remove("empty");
        slot.classList.add("filled");
        slot.dataset.savedPhotoId = photo.id;
    });
}

function loadInlineInspectionData(button, editor) {
    const siteId = $("#siteId").val();
    const itemId = button.dataset.itemId;
    const categoryGroup = button.dataset.categoryGroup;

    const itemCard = button.closest(".item-card");

    $.ajax({
        type: "GET",
        url: "/inspection/detail",
        data: { siteId, itemId, categoryGroup },
        success: function (res) {
            const memo = editor.querySelector(".inline-memo");
            if (memo) {
                memo.value = res.memo || "";
                memo.disabled = false;
                memo.readOnly = false;
            }

            renderSavedPhotos(editor, res.photos || []);

            const hasPhoto = (res.photos || []).length > 0;
            const hasMemo = !!(res.memo && res.memo.trim() !== "");
            const resultValue = res.result || "미작성";

            if (resultValue === "해당사항없음") {
                itemCard.dataset.currentResult = "해당사항없음";
            } else if (hasMemo || hasPhoto || resultValue === "작성") {
                itemCard.dataset.currentResult = "작성";
            } else {
                itemCard.dataset.currentResult = "미작성";
            }

            const row = itemCard.querySelector(".item-row");
            if (row) {
                if (itemCard.dataset.currentResult === "작성" || itemCard.dataset.currentResult === "해당사항없음") {
                    row.classList.add("done");
                } else {
                    row.classList.remove("done");
                }
            }

            syncStatusButton(itemCard);
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert("점검 정보 조회 실패");
        }
    });
}

function saveInlineInspection(button) {
    if (button.dataset.saving === "true") {
        return;
    }

    const siteId = $("#siteId").val();
    const itemId = button.dataset.itemId;
    const categoryGroup = button.dataset.categoryGroup;
    const editor = button.closest(".item-editor");
    const memo = editor.querySelector(".inline-memo").value.trim();

    const itemCard = button.closest(".item-card");
    const result = itemCard.dataset.currentResult || "미작성";

    const originalText = button.textContent;
    button.dataset.saving = "true";
    button.disabled = true;
    button.textContent = "저장중...";

    const formData = new FormData();
    formData.append("siteId", siteId);
    formData.append("itemId", itemId);
    formData.append("categoryGroup", categoryGroup);
    formData.append("result", result);
    formData.append("memo", memo);

    editor.querySelectorAll(".inline-photo-input").forEach(input => {
        if (input.files.length > 0) {
            formData.append("photos", input.files[0]);
        }
    });

    $.ajax({
        type: "POST",
        url: "/inspection/save",
        data: formData,
        processData: false,
        contentType: false,
        success: function () {
            const itemRow = itemCard.querySelector(".item-row");
            const hasPhoto = Array.from(editor.querySelectorAll(".photo-slot"))
                .some(slot => {
                    const savedPhotoId = slot.dataset.savedPhotoId;
                    const input = slot.querySelector(".inline-photo-input");
                    const hasNewFile = input && input.files && input.files.length > 0;
                    const hasPreview = slot.classList.contains("filled");
                    return !!savedPhotoId || hasNewFile || hasPreview;
                });

            let currentResult = itemCard.dataset.currentResult || "미작성";

            if (currentResult === "해당사항없음") {
                itemCard.dataset.currentResult = "해당사항없음";
                itemRow.classList.add("done");
            } else if (memo !== "" || hasPhoto) {
                itemCard.dataset.currentResult = "작성";
                itemRow.classList.add("done");
            } else {
                itemCard.dataset.currentResult = "미작성";
                itemRow.classList.remove("done");
            }

            const locationBox = document.querySelector(
                `.delete-location-btn[data-category-group='${categoryGroup}']`
            )?.closest(".location-box");

            updateLocationProgress(locationBox);

            const memoInput = editor.querySelector(".inline-memo");
            if (memoInput) {
                memoInput.disabled = false;
                memoInput.readOnly = false;
            }

            syncStatusButton(itemCard);
            recalcSiteProgress();

            editor.classList.remove("open");

            const toggleBtn = itemCard.querySelector(".item-toggle-btn");
            if (toggleBtn) {
                toggleBtn.textContent = "열기";
            }
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert(xhr.responseText || "저장 실패");
        },
        complete: function () {
            button.dataset.saving = "false";
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".item-editor").forEach(bindMemoAutoWrite);
    document.querySelectorAll(".photo-slot").forEach(bindInlinePhotoSlot);
    document.querySelectorAll(".item-card").forEach(syncStatusButton);

    document.querySelectorAll(".status-direct-wrap .item-card").forEach(card => {

        const editor = card.querySelector(".item-editor");

        const fakeBtn = {
            dataset: {
                itemId: card.querySelector(".inline-save-btn").dataset.itemId,
                categoryGroup: card.querySelector(".inline-save-btn").dataset.categoryGroup
            },
            closest: () => card
        };

        loadInlineInspectionData(fakeBtn, editor);
    });


    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            $.ajax({
                type: "POST",
                url: "/logout",
                success: function () {
                    alert("로그아웃되었습니다.");
                    window.location.href = "/";
                },
                error: function () {
                    alert("로그아웃 실패");
                }
            });
        });
    }

    const deleteSiteBtn = document.getElementById("deleteSiteBtn");
    if (deleteSiteBtn) {
        deleteSiteBtn.addEventListener("click", function () {
            const siteId = document.getElementById("siteId").value;

            if (!confirm("정말 이 현장을 삭제하시겠습니까?")) return;

            const confirmText = prompt("삭제하려면 '삭제' 라고 입력하세요");
            if (confirmText !== "삭제") {
                alert("입력이 일치하지 않아 취소되었습니다.");
                return;
            }

            $.ajax({
                type: "POST",
                url: "/site/delete",
                data: { siteId },
                success: function () {
                    alert("현장이 삭제되었습니다.");
                    window.location.href = "/loginOk";
                },
                error: function (xhr) {
                    console.error(xhr.responseText);
                    alert("삭제 실패");
                }
            });
        });
    }
});

let currentResultTarget = null;

function openResultModal(button) {
    currentResultTarget = button;

    const currentValue = button.dataset.currentResult || "미작성";
    const modal = document.getElementById("resultModal");

    document.querySelectorAll("input[name='resultOption']").forEach(radio => {
        radio.checked = (radio.value === currentValue);
    });

    modal.style.display = "flex";
}

function closeResultModal() {
    const modal = document.getElementById("resultModal");
    modal.style.display = "none";
    currentResultTarget = null;
}

function applyResultModal() {
    if (!currentResultTarget) return;

    const checked = document.querySelector("input[name='resultOption']:checked");
    if (!checked) {
        alert("상태를 선택해주세요.");
        return;
    }

    const value = checked.value;
    currentResultTarget.dataset.currentResult = value;
    currentResultTarget.textContent = value;

    if (value === "해당사항없음") {
        const itemCard = currentResultTarget.closest(".item-card");
        const saveBtn = itemCard.querySelector(".inline-save-btn");

        if (saveBtn) {
            saveInlineInspection(saveBtn);
        }
    }

    closeResultModal();
}

function toggleItemEditorByButton(button) {
    const card = button.closest(".item-card");
    const editor = card.querySelector(".item-editor");

    document.querySelectorAll(".item-editor.open").forEach(el => {
        el.classList.remove("open");
    });

    document.querySelectorAll(".item-toggle-btn").forEach(btn => {
        btn.textContent = "열기";
    });

    editor.classList.add("open");
    button.textContent = "열기";

    loadInlineInspectionData(button, editor);

    setTimeout(() => {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
}

function setItemResult(button, value) {
    const itemCard = button.closest(".item-card");
    const row = itemCard.querySelector(".item-row");

    itemCard.dataset.currentResult = value;

    if (row && value === "미작성") {
        row.classList.remove("done");
    }

    syncStatusButton(itemCard);
}

function setItemResultAndSave(button, value) {
    const itemCard = button.closest(".item-card");
    const editor = itemCard.querySelector(".item-editor");
    const memo = editor.querySelector(".inline-memo")?.value.trim() || "";

    const hasPhoto = Array.from(editor.querySelectorAll(".photo-slot"))
        .some(slot => {
            const savedPhotoId = slot.dataset.savedPhotoId;
            const input = slot.querySelector(".inline-photo-input");
            const hasNewFile = input && input.files && input.files.length > 0;
            const hasPreview = slot.classList.contains("filled");
            return !!savedPhotoId || hasNewFile || hasPreview;
        });

    if (memo !== "" || hasPhoto) {
        const ok = confirm("사진 or 메모가 있는 항목입니다. 삭제하시겠습니까?");
        if (!ok) return;

        resetInspectionState(itemCard, "해당사항없음");
        return;
    }

    itemCard.dataset.currentResult = "해당사항없음";

    const saveBtn = itemCard.querySelector(".inline-save-btn");
    if (saveBtn) {
        saveInlineInspection(saveBtn);
    }
}

function clearAllInlinePhotos(editor) {
    editor.querySelectorAll(".photo-slot").forEach(slot => {
        const input = slot.querySelector(".inline-photo-input");
        const img = slot.querySelector(".photo-slot-img");
        const text = slot.querySelector(".photo-slot-text");
        const delBtn = slot.querySelector(".photo-delete-btn");

        if (input) {
            input.value = "";
        }

        if (img) {
            img.src = "";
            img.style.display = "none";
        }

        if (text) {
            text.style.display = "block";
        }

        if (delBtn) {
            delBtn.style.display = "none";
        }

        slot.classList.add("empty");
        slot.classList.remove("filled");
        delete slot.dataset.savedPhotoId;
    });
}

function resetInspectionState(itemCard, targetResult) {
    const siteId = $("#siteId").val();
    const saveBtn = itemCard.querySelector(".inline-save-btn");
    const itemId = saveBtn.dataset.itemId;
    const categoryGroup = saveBtn.dataset.categoryGroup;
    const editor = itemCard.querySelector(".item-editor");

    $.ajax({
        type: "POST",
        url: "/inspection/reset",
        data: {
            siteId,
            itemId,
            categoryGroup,
            targetResult
        },
        success: function () {
            editor.querySelectorAll(".photo-slot").forEach(slot => {
                clearInlineSlot(slot);
            });

            const memoInput = editor.querySelector(".inline-memo");
            if (memoInput) {
                memoInput.value = "";
                memoInput.disabled = false;
                memoInput.readOnly = false;
            }

            itemCard.dataset.currentResult = targetResult;

            const row = itemCard.querySelector(".item-row");
            if (row) {
                if (targetResult === "해당사항없음") {
                    row.classList.add("done");
                } else {
                    row.classList.remove("done");
                }
            }

            const locationBox = itemCard.closest(".location-box");
            if (locationBox) {
                updateLocationProgress(locationBox);
            }

            syncStatusButton(itemCard);
            recalcSiteProgress();
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert(xhr.responseText || "상태 변경 실패");
        }
    });
}

function bindMemoAutoWrite(editor) {
    const memoInput = editor.querySelector(".inline-memo");
    if (!memoInput) return;

    memoInput.addEventListener("input", function () {
        const itemCard = editor.closest(".item-card");
        const itemRow = itemCard.querySelector(".item-row");

        if (memoInput.value.trim() !== "") {
            itemCard.dataset.currentResult = "작성";
            if (itemRow) {
                itemRow.classList.add("done");
            }
        }

        syncStatusButton(itemCard);
    });

    function openCategoryEditModal() {
        const siteId = $("#siteId").val();

        $.ajax({
            type: "GET",
            url: "/site/category-edit-data",
            data: { siteId: siteId },
            dataType: "json",
            success: function (result) {
                let html = "";
                const selectedSet = new Set(result.selectedCategories || []);

                result.allCategories.forEach(function (item) {
                    const checked = selectedSet.has(item.category) ? "checked" : "";

                    html += `
                    <label class="category-item">
                        <input type="checkbox" name="editCategoryItem" value="${item.category}" ${checked}>
                        <span>${item.category}</span>
                    </label>
                `;
                });

                $("#categoryEditBox").html(html);
                $("#categoryEditModal").show();
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("점검항목 목록을 불러오지 못했습니다.");
            }
        });
    }

    function closeCategoryEditModal() {
        $("#categoryEditModal").hide();
    }

    $(document).on("click", "#editCheckAllBtn", function () {
        $("input[name='editCategoryItem']").prop("checked", true);
    });

    $(document).on("click", "#editUncheckAllBtn", function () {
        $("input[name='editCategoryItem']").prop("checked", false);
    });

    function saveCategoryEdit() {
        const siteId = $("#siteId").val();
        const categories = [];

        $("input[name='editCategoryItem']:checked").each(function () {
            categories.push($(this).val());
        });

        if (categories.length === 0) {
            alert("최소 1개 이상 선택해주세요.");
            return;
        }

        $.ajax({
            type: "POST",
            url: "/site/category-edit",
            contentType: "application/json",
            data: JSON.stringify({
                siteId: siteId,
                categories: categories
            }),
            success: function () {
                alert("점검항목이 수정되었습니다.");
                location.reload();
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert(xhr.responseText || "점검항목 수정 중 오류가 발생했습니다.");
            }
        });
    }
}

function openCategoryEditModal() {
    const siteId = $("#siteId").val();

    $.ajax({
        type: "GET",
        url: "/site/category-edit-data",
        data: { siteId: siteId },
        dataType: "json",
        success: function (result) {
            let html = "";
            const selectedSet = new Set(result.selectedCategories || []);

            (result.allCategories || []).forEach(function (item) {
                const checked = selectedSet.has(item.category) ? "checked" : "";

                html += `
                    <label class="category-item">
                        <input type="checkbox" name="editCategoryItem" value="${item.category}" ${checked}>
                        <span>${item.category}</span>
                    </label>
                `;
            });

            $("#categoryEditBox").html(html);
            $("#categoryEditModal").show();
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert("점검항목 목록을 불러오지 못했습니다.");
        }
    });
}

function closeCategoryEditModal() {
    $("#categoryEditModal").hide();
}

$(document).on("click", "#editCheckAllBtn", function () {
    $("input[name='editCategoryItem']").prop("checked", true);
});

$(document).on("click", "#editUncheckAllBtn", function () {
    $("input[name='editCategoryItem']").prop("checked", false);
});

function saveCategoryEdit() {
    const siteId = $("#siteId").val();
    const categories = [];

    $("input[name='editCategoryItem']:checked").each(function () {
        categories.push($(this).val());
    });

    if (categories.length === 0) {
        alert("최소 1개 이상 선택해주세요.");
        return;
    }

    $.ajax({
        type: "POST",
        url: "/site/category-edit",
        contentType: "application/json",
        data: JSON.stringify({
            siteId: siteId,
            categories: categories
        }),
        success: function () {
            alert("점검항목이 수정되었습니다.");
            location.reload();
        },
        error: function (xhr) {
            console.error(xhr.responseText);
            alert(xhr.responseText || "점검항목 수정 중 오류가 발생했습니다.");
        }
    });
}