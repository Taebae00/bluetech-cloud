function toggleCategory(button) {
    const box = button.closest(".category-box");
    const inner = box.querySelector(".category-inner");
    if (inner) inner.classList.toggle("open");
}

function toggleLocation(button) {
    const locationBox = button.closest(".location-box");
    const itemList = locationBox.querySelector(".item-list");
    if (itemList) itemList.classList.toggle("open");
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
        success: function (res) {
            alert("위치가 추가되었습니다.");

            const categoryInner = categoryBox.querySelector(".category-inner");
            if (categoryInner) {
                categoryInner.classList.add("open");
            }

            let locationList = categoryBox.querySelector(".location-list");
            if (!locationList) {
                locationList = document.createElement("div");
                locationList.className = "location-list";
                categoryInner.appendChild(locationList);
            }

            // 기존 열려있던 위치 아코디언 닫기
            categoryBox.querySelectorAll(".item-list.open").forEach(el => {
                el.classList.remove("open");
            });

            const groupName = res.groupName;
            const locationName = res.locationName;
            const items = Array.isArray(res.items) ? res.items : [];
            const totalCount = items.length;

            const itemButtons = items.map(item => {
                const contentText = `${item.order_no}. ${item.content}`;

                return `
            <div class="item-card">
                <div class="item-row">
                    <button type="button"
                            class="item-status-badge status-open-btn"
                            data-item-id="${item.id}"
                            data-category-group="${groupName}"
                            data-current-result="미작성"
                            onclick="openResultModal(this)">
                        미작성
                    </button>

                    <span class="item-content-text">${contentText}</span>

                    <button type="button"
                            class="item-toggle-btn"
                            data-item-id="${item.id}"
                            data-item-content="${item.content}"
                            data-category-group="${groupName}"
                            onclick="toggleItemEditorByButton(this)">
                        열기
                    </button>
                </div>

                <div class="item-editor">
                    <div class="section-label">점검내용</div>
                    <div class="modal-content-text">${contentText}</div>

                    <div class="section-label">사진첨부</div>
                    <div class="photo-grid editor-photo-grid">
                        <div class="photo-slot empty" onclick="triggerInlinePhotoInput(this)">
                            <span class="photo-slot-text">+ 현장사진</span>
                            <img class="photo-slot-img" style="display:none;">
                            <input type="file" class="inline-photo-input" accept="image/*" capture="environment" style="display:none;">
                            <button type="button" class="photo-delete-btn" style="display:none;" onclick="removeInlinePhoto(event, this)">×</button>
                        </div>
                        <div class="photo-slot empty" onclick="triggerInlinePhotoInput(this)">
                            <span class="photo-slot-text">+ 현장사진</span>
                            <img class="photo-slot-img" style="display:none;">
                            <input type="file" class="inline-photo-input" accept="image/*" capture="environment" style="display:none;">
                            <button type="button" class="photo-delete-btn" style="display:none;" onclick="removeInlinePhoto(event, this)">×</button>
                        </div>
                    </div>

                    <button type="button" class="add-photo-btn" onclick="addInlinePhotoSlot(this)">+ 사진추가</button>

                    <div class="modal-group">
                        <label>메모</label>
                        <textarea class="inline-memo" rows="4" placeholder="메모를 입력하세요"></textarea>
                    </div>

                    <div class="inline-btn-wrap">
                        <button type="button"
                                class="inline-save-btn"
                                data-item-id="${item.id}"
                                data-category-group="${groupName}"
                                onclick="saveInlineInspection(this)">
                            저장
                        </button>
                    </div>
                </div>
            </div>
        `;
            }).join("");

            const newLocationHtml = `
        <div class="location-box">
            <div class="location-header">
                <button type="button" class="location-title" onclick="toggleLocation(this)">
                    <div class="location-title-left">
                        <span class="location-title-main">${locationName}</span>
                    </div>
                    <div class="location-title-right">
                        <span class="location-progress-label">진행도</span>
                        <span class="location-progress">0/${totalCount}</span>
                    </div>
                </button>

                <button type="button"
                        class="delete-location-btn"
                        data-category-group="${groupName}"
                        onclick="deleteLocation(this)">
                    삭제
                </button>
            </div>

            <div class="item-list">
                ${itemButtons}
            </div>
        </div>
    `;

            locationList.insertAdjacentHTML("beforeend", newLocationHtml);

            const newBox = locationList.lastElementChild;
            if (newBox) {
                newBox.querySelectorAll(".photo-slot").forEach(bindInlinePhotoSlot);
            }

            input.value = "";

            const titleSpan = categoryBox.querySelector(".category-title span");
            if (titleSpan) {
                const currentText = titleSpan.textContent;
                const match = currentText.match(/^(.*)\((\d+)\)$/);

                if (match) {
                    const title = match[1].trim();
                    const count = parseInt(match[2], 10) + 1;
                    titleSpan.textContent = `${title} (${count})`;
                }
            }
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
            if (locationBox) {
                locationBox.remove();
            }
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
    const resultBtn = itemCard.querySelector(".status-open-btn");
    if (resultBtn) {
        const resultValue = res.result || "미작성";
        resultBtn.dataset.currentResult = resultValue;
        resultBtn.textContent = resultValue;
    }

    $.ajax({
        type: "GET",
        url: "/inspection/detail",
        data: { siteId, itemId, categoryGroup },
        success: function (res) {
            const memo = editor.querySelector(".inline-memo");
            if (memo) memo.value = res.memo || "";
            renderSavedPhotos(editor, res.photos || []);
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
    const resultBtn = itemCard.querySelector(".status-open-btn");
    const result = resultBtn ? (resultBtn.dataset.currentResult || "미작성") : "미작성";

    const hasPhoto = Array.from(editor.querySelectorAll(".inline-photo-input"))
        .some(input => input.files.length > 0);

    if (result !== "해당사항없음" && memo === "" && !hasPhoto) {
        alert("메모 또는 사진이 있어야 저장할 수 있습니다.");
        return;
    }

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
            if (itemRow) {
                itemRow.classList.add("done");
            }

            if (resultBtn) {
                if (result === "해당사항없음") {
                    resultBtn.textContent = "해당사항없음";
                    resultBtn.dataset.currentResult = "해당사항없음";
                } else {
                    resultBtn.textContent = "작성";
                    resultBtn.dataset.currentResult = "작성";
                }
            }

            const locationBox = document.querySelector(
                `.delete-location-btn[data-category-group='${categoryGroup}']`
            )?.closest(".location-box");

            if (locationBox) {
                const total = locationBox.querySelectorAll(".item-row").length;
                const completed = Array.from(locationBox.querySelectorAll(".status-open-btn"))
                    .filter(btn => {
                        const val = btn.dataset.currentResult || "미작성";
                        return val === "작성" || val === "해당사항없음";
                    }).length;

                const progress = locationBox.querySelector(".location-progress");
                if (progress) {
                    progress.textContent = `${completed}/${total}`;
                }
            }

            // 저장 후 세부점검사항 아코디언 닫기
            editor.classList.remove("open");

            const toggleBtn = itemCard.querySelector(".item-toggle-btn");
            if (toggleBtn) {
                toggleBtn.textContent = "열기";
            }

            alert("저장되었습니다.");
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
    document.querySelectorAll(".photo-slot").forEach(bindInlinePhotoSlot);

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

    // 해당사항없음이면 바로 저장
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
    const isOpen = editor.classList.contains("open");

    document.querySelectorAll(".item-editor.open").forEach(el => {
        el.classList.remove("open");
    });

    document.querySelectorAll(".item-toggle-btn").forEach(btn => {
        btn.textContent = "열기";
    });

    if (!isOpen) {
        editor.classList.add("open");
        button.textContent = "닫기";
        loadInlineInspectionData(button, editor);
    }
}