let isSyncing = false;

function setSyncLoading(show, text = "잠시만 기다려주세요.") {
    const modal = document.getElementById("syncStatusModal");
    const subtext = document.getElementById("syncStatusSubtext");
    const title = document.getElementById("syncStatusTitle");
    const closeBtn = document.getElementById("syncStatusCloseBtn");
    const syncBtn = document.querySelector(".sync-btn");

    if (subtext) subtext.textContent = text;

    if (title && show) {
        title.textContent = "동기화 중입니다...";
    }

    if (closeBtn && show) {
        closeBtn.disabled = true;
    }

    if (syncBtn) {
        syncBtn.disabled = show;
        syncBtn.textContent = show ? "동기화 중..." : "동기화";
    }

    if (modal) {
        modal.style.display = show ? "flex" : "none";
    }
}

async function updatePendingSyncBadge() {
    const siteId = Number($("#siteId").val());
    const syncBtn = document.querySelector(".sync-btn");
    if (!syncBtn) return;

    const results = (await OfflineDB.getAll("draft_results"))
        .filter(x => x.siteId === siteId && x.syncStatus === "pending");

    const totalCount = results.length;

    syncBtn.textContent = totalCount > 0 ? `동기화 (${totalCount})` : "동기화";
}

function finishSyncStatus(success, message) {
    const title = document.getElementById("syncStatusTitle");
    const subtext = document.getElementById("syncStatusSubtext");
    const closeBtn = document.getElementById("syncStatusCloseBtn");
    const syncBtn = document.querySelector(".sync-btn");

    if (title) {
        title.textContent = success ? "동기화 완료" : "동기화 실패";
    }

    if (subtext) {
        subtext.textContent = message || (success ? "완료 버튼을 눌러 닫아주세요." : "문제가 발생했습니다. 다시 시도해주세요.");
    }

    if (closeBtn) {
        closeBtn.disabled = false;
    }

    if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = "동기화";
    }
}


function closeSyncStatusModal() {
    if (isSyncing) return;

    const modal = document.getElementById("syncStatusModal");
    if (modal) {
        modal.style.display = "none";
    }
}

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

function makeDraftKey(siteId, itemId, categoryGroup) {
    return `${siteId}_${itemId}_${categoryGroup}`;
}

async function saveInlineInspection(button) {
    if (button.dataset.saving === "true") return;

    const siteId = $("#siteId").val();
    const itemId = button.dataset.itemId;
    const categoryGroup = button.dataset.categoryGroup;
    const editor = button.closest(".item-editor");
    const memo = editor.querySelector(".inline-memo")?.value.trim() || "";

    const itemCard = button.closest(".item-card");
    const itemRow = itemCard.querySelector(".item-row");
    const currentResult = itemCard.dataset.currentResult || "미작성";
    const draftKey = makeDraftKey(siteId, itemId, categoryGroup);

    const originalText = button.textContent;
    button.dataset.saving = "true";
    button.disabled = true;
    button.textContent = "로컬저장중...";

    try {
        const photoInputs = editor.querySelectorAll(".inline-photo-input");
        for (const input of photoInputs) {
            if (input.files && input.files.length > 0) {
                const file = input.files[0];
                const slot = input.closest(".photo-slot");

                // 이미 로컬 사진이 있던 슬롯이면 기존 로컬 draft 삭제 후 교체
                if (slot?.dataset.localPhotoKey) {
                    await OfflineDB.deleteByKey("draft_photos", slot.dataset.localPhotoKey);
                    delete slot.dataset.localPhotoKey;
                }

                const photoKey = generateUUID();

                await OfflineDB.put("draft_photos", {
                    photoKey,
                    draftKey,
                    fileBlob: file,
                    fileName: file.name,
                    isDeleted: false,
                    syncStatus: "pending",
                    createdAt: new Date().toISOString()
                });

                if (slot) {
                    slot.dataset.localPhotoKey = photoKey;
                    delete slot.dataset.savedPhotoId;
                }

                input.value = "";
            }
        }

        const hasPhoto = Array.from(editor.querySelectorAll(".photo-slot"))
            .some(slot => {
                const hasSavedPhoto = !!slot.dataset.savedPhotoId;
                const hasLocalPhoto = !!slot.dataset.localPhotoKey;
                const hasFilled = slot.classList.contains("filled");
                return hasSavedPhoto || hasLocalPhoto || hasFilled;
            });

        // 3. 최종 result 계산
        let finalResult = "미작성";

        if (currentResult === "해당사항없음") {
            finalResult = "해당사항없음";
        } else if (memo !== "" || hasPhoto) {
            finalResult = "작성";
        }

        // 4. 최종 result로 draft_results 저장
        await OfflineDB.put("draft_results", {
            draftKey,
            siteId: Number(siteId),
            itemId: Number(itemId),
            categoryGroup,
            result: finalResult,
            memo,
            updatedAt: new Date().toISOString(),
            syncStatus: "pending"
        });

        // 5. 화면 상태도 finalResult로 맞춤
        itemCard.dataset.currentResult = finalResult;

        if (finalResult === "작성" || finalResult === "해당사항없음") {
            if (itemRow) itemRow.classList.add("done");
        } else {
            if (itemRow) itemRow.classList.remove("done");
        }

        syncStatusButton(itemCard);

        const locationBox = itemCard.closest(".location-box");
        if (locationBox) updateLocationProgress(locationBox);

        recalcSiteProgress();
        await refreshVisibleItemStates();
        await updatePendingSyncBadge();

        alert("로컬 저장 완료");
    } catch (e) {
        console.error(e);
        alert("로컬 저장 실패");
    } finally {
        button.dataset.saving = "false";
        button.disabled = false;
        button.textContent = originalText;
    }
}

function updateSyncProgress(done, total, text = "") {
    const percent = total <= 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
    const fill = document.getElementById("syncProgressFill");
    const progressText = document.getElementById("syncProgressText");
    const subtext = document.getElementById("syncStatusSubtext");

    if (fill) {
        fill.style.width = `${percent}%`;
    }

    if (progressText) {
        progressText.textContent = total > 0 ? `${percent}% (${done}/${total})` : "0%";
    }

    if (subtext && text) {
        subtext.textContent = text;
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

async function refreshVisibleItemStates() {
    const siteId = $("#siteId").val();
    const allDrafts = await OfflineDB.getAll("draft_results");
    const allPhotos = await OfflineDB.getAll("draft_photos");

    document.querySelectorAll(".item-card").forEach(itemCard => {
        const saveBtn = itemCard.querySelector(".inline-save-btn");
        if (!saveBtn) return;

        const itemId = saveBtn.dataset.itemId;
        const categoryGroup = saveBtn.dataset.categoryGroup;
        const draftKey = makeDraftKey(siteId, itemId, categoryGroup);

        const draft = allDrafts.find(x => x.draftKey === draftKey);
        const localPhotos = allPhotos.filter(x => x.draftKey === draftKey && x.isDeleted !== true);

        const row = itemCard.querySelector(".item-row");

        // 로컬 변경이 전혀 없으면 서버가 렌더한 현재 상태를 유지
        if (!draft && localPhotos.length === 0) {
            syncStatusButton(itemCard);
            return;
        }

        const editor = itemCard.querySelector(".item-editor");
        const memoInput = editor?.querySelector(".inline-memo");
        const memoValue = draft ? (draft.memo || "") : (memoInput?.value?.trim() || "");

        const hasPhoto = localPhotos.length > 0 ||
            Array.from(itemCard.querySelectorAll(".photo-slot")).some(slot =>
                !!slot.dataset.savedPhotoId || !!slot.dataset.localPhotoKey || slot.classList.contains("filled")
            );

        if (draft?.result === "해당사항없음") {
            itemCard.dataset.currentResult = "해당사항없음";
        } else if (memoValue !== "" || hasPhoto) {
            itemCard.dataset.currentResult = "작성";
        } else {
            itemCard.dataset.currentResult = "미작성";
        }

        if (row) {
            if (itemCard.dataset.currentResult === "작성" || itemCard.dataset.currentResult === "해당사항없음") {
                row.classList.add("done");
            } else {
                row.classList.remove("done");
            }
        }

        syncStatusButton(itemCard);
    });

    document.querySelectorAll(".location-box").forEach(updateLocationProgress);
    recalcSiteProgress();
}

function recalcSiteProgress() {
    const siteNameBox = document.querySelector(".site-name");
    const categoryBoxes = document.querySelectorAll(".category-box");
    const fixedTotal = Number(document.getElementById("siteTotalCount")?.value || categoryBoxes.length);

    let siteCompleted = 0;

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

        siteNameBox.textContent = `${siteTitle} 현장 (${siteCompleted}/${fixedTotal})`;
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

    if (button.dataset.deleting === "true") return;
    if (!confirm("이 위치를 삭제할까요?")) return;

    const originalText = button.textContent;
    button.dataset.deleting = "true";
    button.disabled = true;
    button.textContent = "삭제중...";

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
        },
        complete: function () {
            button.dataset.deleting = "false";
            button.disabled = false;
            button.textContent = originalText;
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

    input.onchange = async function () {
        const file = input.files[0];
        if (!file) return;

        const savedPhotoId = slot.dataset.savedPhotoId;

        try {
            // 기존 서버 사진이 있는 슬롯에 새 사진을 올리면 삭제 예약 먼저
            if (savedPhotoId) {
                await OfflineDB.put("draft_photos", {
                    photoKey: `delete_${savedPhotoId}`,
                    serverPhotoId: Number(savedPhotoId),
                    isDeleted: true,
                    syncStatus: "pending",
                    createdAt: new Date().toISOString()
                });
            }

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

            await updatePendingSyncBadge();
        } catch (e) {
            console.error(e);
            alert("사진 교체 준비 실패");
        }
    };
}


async function removeInlinePhoto(event, button) {
    event.stopPropagation();

    if (button.dataset.deleting === "true") return;

    const slot = button.closest(".photo-slot");
    const localPhotoKey = slot.dataset.localPhotoKey;
    const savedPhotoId = slot.dataset.savedPhotoId;

    const originalText = button.textContent;
    button.dataset.deleting = "true";
    button.disabled = true;
    button.textContent = "...";

    try {
        if (localPhotoKey) {
            await OfflineDB.deleteByKey("draft_photos", localPhotoKey);
            clearInlineSlot(slot);
            await updatePendingSyncBadge();
            return;
        }

        if (savedPhotoId) {
            await OfflineDB.put("draft_photos", {
                photoKey: `delete_${savedPhotoId}`,
                serverPhotoId: Number(savedPhotoId),
                isDeleted: true,
                syncStatus: "pending",
                createdAt: new Date().toISOString()
            });
            clearInlineSlot(slot);
            await updatePendingSyncBadge();
            return;
        }

        clearInlineSlot(slot);
    } catch (e) {
        console.error(e);
        alert("사진 삭제 처리 실패");
    } finally {
        button.dataset.deleting = "false";
        button.disabled = false;
        button.textContent = originalText;
    }
}

function clearInlineSlot(slot) {
    const input = slot.querySelector(".inline-photo-input");
    const img = slot.querySelector(".photo-slot-img");
    const text = slot.querySelector(".photo-slot-text");
    const delBtn = slot.querySelector(".photo-delete-btn");

    if (input) input.value = "";

    if (img) {
        if (img.dataset.objectUrl) {
            URL.revokeObjectURL(img.dataset.objectUrl);
            delete img.dataset.objectUrl;
        }
        img.src = "";
        img.style.display = "none";
    }

    if (text) text.style.display = "block";
    if (delBtn) delBtn.style.display = "none";

    slot.classList.add("empty");
    slot.classList.remove("filled");

    delete slot.dataset.savedPhotoId;
    delete slot.dataset.localPhotoKey;
}

function ensurePhotoSlots(grid, count) {
    const slots = Array.from(grid.querySelectorAll(".photo-slot"));

    while (slots.length < Math.max(2, count)) {
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

    return slots;
}

function renderAllPhotos(editor, photoItems) {
    const grid = editor.querySelector(".editor-photo-grid");
    if (!grid) return;

    const list = photoItems || [];
    const slots = ensurePhotoSlots(grid, list.length);

    slots.forEach(slot => clearInlineSlot(slot));

    list.forEach((photo, index) => {
        const slot = slots[index];
        const img = slot.querySelector(".photo-slot-img");
        const text = slot.querySelector(".photo-slot-text");
        const delBtn = slot.querySelector(".photo-delete-btn");

        let src = "";

        if (photo.type === "local") {
            src = URL.createObjectURL(photo.fileBlob);
            img.dataset.objectUrl = src;
            slot.dataset.localPhotoKey = photo.photoKey;
        } else {
            src = photo.fileUrl || "";
            slot.dataset.savedPhotoId = photo.id;
        }

        img.src = src;
        img.style.display = "block";
        text.style.display = "none";
        delBtn.style.display = "flex";

        slot.classList.remove("empty");
        slot.classList.add("filled");
    });
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


function renderLocalPhotos(editor, photos) {
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

        img.src = URL.createObjectURL(photo.fileBlob);
        img.style.display = "block";
        text.style.display = "none";
        delBtn.style.display = "flex";
        slot.classList.remove("empty");
        slot.classList.add("filled");
        slot.dataset.localPhotoKey = photo.photoKey;
    });
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

async function loadInlineInspectionData(button, editor) {
    const siteId = $("#siteId").val();
    const itemId = button.dataset.itemId;
    const categoryGroup = button.dataset.categoryGroup;
    const draftKey = makeDraftKey(siteId, itemId, categoryGroup);

    const itemCard = button.closest(".item-card");

    try {
        const serverRes = await $.ajax({
            type: "GET",
            url: "/inspection/detail",
            data: { siteId, itemId, categoryGroup }
        });

        const localDraft = await OfflineDB.get("draft_results", draftKey);
        const allLocalPhotos = await OfflineDB.getAll("draft_photos");

        const localPhotos = allLocalPhotos.filter(photo =>
            photo.draftKey === draftKey &&
            photo.isDeleted !== true
        );

        const deletedServerPhotoIds = allLocalPhotos
            .filter(photo => photo.isDeleted === true && photo.serverPhotoId)
            .map(photo => Number(photo.serverPhotoId));

        const serverPhotos = (serverRes.photos || [])
            .filter(photo => !deletedServerPhotoIds.includes(Number(photo.id)));

        const mergedPhotos = [
            ...serverPhotos.map(photo => ({
                type: "server",
                id: photo.id,
                fileUrl: photo.fileUrl || photo.file_url || photo.url || ""
            })),
            ...localPhotos.map(photo => ({
                type: "local",
                photoKey: photo.photoKey,
                fileBlob: photo.fileBlob,
                fileName: photo.fileName
            }))
        ];

        const finalMemo = localDraft ? (localDraft.memo || "") : (serverRes.memo || "");
        const finalResult = localDraft ? (localDraft.result || "미작성") : (serverRes.result || "미작성");

        const memo = editor.querySelector(".inline-memo");
        if (memo) {
            memo.value = finalMemo;
            memo.disabled = false;
            memo.readOnly = false;
        }

        renderAllPhotos(editor, mergedPhotos);

        const hasPhoto = mergedPhotos.length > 0;
        const hasMemo = !!(finalMemo && finalMemo.trim() !== "");

        if (finalResult === "해당사항없음") {
            itemCard.dataset.currentResult = "해당사항없음";
        } else if (hasMemo || hasPhoto || finalResult === "작성") {
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
    } catch (e) {
        console.error(e);
        alert("점검 정보 조회 실패");
    }
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
            if (deleteSiteBtn.dataset.deleting === "true") return;

            const siteId = document.getElementById("siteId").value;

            if (!confirm("정말 이 현장을 삭제하시겠습니까?")) return;

            const confirmText = prompt("삭제하려면 '삭제' 라고 입력하세요");
            if (confirmText !== "삭제") {
                alert("입력이 일치하지 않아 취소되었습니다.");
                return;
            }

            const originalText = deleteSiteBtn.textContent;
            deleteSiteBtn.dataset.deleting = "true";
            deleteSiteBtn.disabled = true;
            deleteSiteBtn.textContent = "삭제중...";

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
                },
                complete: function () {
                    deleteSiteBtn.dataset.deleting = "false";
                    deleteSiteBtn.disabled = false;
                    deleteSiteBtn.textContent = originalText;
                }
            });
        });
    }

    refreshVisibleItemStates();
    updatePendingSyncBadge();
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

async function syncOfflineData() {
    if (isSyncing) return;

    const siteId = Number($("#siteId").val());

    try {
        isSyncing = true;
        setSyncLoading(true, "동기화 준비 중입니다.");

        const allResults = await OfflineDB.getAll("draft_results");
        const allPhotos = await OfflineDB.getAll("draft_photos");

        const results = allResults.filter(x =>
            x.siteId === siteId && x.syncStatus === "pending"
        );

        const resultDraftKeys = new Set(results.map(r => r.draftKey));

        // 새로 업로드할 사진만
        const uploadPhotos = allPhotos.filter(x => {
            if (x.syncStatus !== "pending") return false;
            if (x.isDeleted === true) return false;
            return !!x.draftKey && resultDraftKeys.has(x.draftKey);
        });

        // 삭제 예약된 서버 사진
        const deletePhotos = allPhotos.filter(x => {
            if (x.syncStatus !== "pending") return false;
            if (x.isDeleted !== true) return false;
            return !!x.serverPhotoId;
        });

        // 사용자 기준 카운트:
        // - 메모 있는 result만 1건
        // - 새 사진은 장수만큼 1건
        const memoResults = results.filter(r => (r.memo || "").trim() !== "");
        const totalSteps = memoResults.length + uploadPhotos.length;

        if (results.length === 0 && uploadPhotos.length === 0 && deletePhotos.length === 0) {
            updateSyncProgress(0, 0, "동기화할 데이터가 없습니다.");
            finishSyncStatus(true, "동기화할 데이터가 없습니다. 완료 버튼을 눌러 닫아주세요.");
            return;
        }

        let doneSteps = 0;
        updateSyncProgress(doneSteps, totalSteps, "점검 결과를 서버에 저장하는 중입니다.");

        // 1. 결과 저장 (서버에는 result 전체를 보내야 함)
        const res = await fetch(`/sync/site/${siteId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                results: results,
                locations: []
            })
        });

        if (!res.ok) {
            throw new Error("결과 동기화 실패");
        }

        const data = await res.json();
        const resultIdMap = data.resultIdMap || {};

        // 메모 있는 result만 진행률 반영
        doneSteps += memoResults.length;
        updateSyncProgress(
            doneSteps,
            totalSteps,
            memoResults.length > 0 ? "메모 동기화 완료" : "메모 동기화할 데이터 없음"
        );

        // 2. 서버 사진 삭제 예약 처리 (진행률 카운트 제외)
        for (const photo of deletePhotos) {
            await fetch("/inspection/photo/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    photoId: photo.serverPhotoId
                })
            });
        }

        // 3. 새 사진 업로드
        for (const photo of uploadPhotos) {
            const resultId = resultIdMap[photo.draftKey];
            if (!resultId) continue;

            const formData = new FormData();
            formData.append("resultId", resultId);
            formData.append("photo", photo.fileBlob, photo.fileName);

            const uploadRes = await fetch("/sync/photo/upload", {
                method: "POST",
                body: formData
            });

            if (!uploadRes.ok) {
                throw new Error("사진 업로드 실패");
            }

            doneSteps++;
            updateSyncProgress(doneSteps, totalSteps, "사진 업로드 중...");
        }

        // 4. 동기화 성공한 로컬 데이터 정리
        for (const r of results) {
            await OfflineDB.deleteByKey("draft_results", r.draftKey);
        }

        for (const p of [...uploadPhotos, ...deletePhotos]) {
            await OfflineDB.deleteByKey("draft_photos", p.photoKey);
        }

        await refreshVisibleItemStates();
        await updatePendingSyncBadge();

        finishSyncStatus(true, "동기화가 완료되었습니다. 완료 버튼을 눌러 닫아주세요.");
    } catch (e) {
        console.error(e);
        finishSyncStatus(false, "동기화 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
        isSyncing = false;
    }
}

function generateUUID() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // fallback (구형 브라우저)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}