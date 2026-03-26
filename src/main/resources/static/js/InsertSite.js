$(function () {
    console.log("InsertSite.js loaded");

    $("#openSiteModal").on("click", function () {
        $("#siteModal").show();
        $("#siteNameInput").val("").focus();
    });

    $("#closeSiteModal").on("click", function () {
        $("#siteModal").hide();
    });

    $("#siteModal").on("click", function (e) {
        if (e.target.id === "siteModal") {
            $("#siteModal").hide();
        }
    });

    $("#saveSiteBtn").on("click", function () {
        const siteName = $("#siteNameInput").val().trim();

        if (siteName === "") {
            alert("현장명을 입력해주세요.");
            return;
        }

        $.ajax({
            type: "POST",
            url: "/site/add",
            data: { siteName: siteName },
            dataType: "json",
            success: function (result) {
                console.log(result);

                $("#siteModal").hide();
                $("#emptyBox").hide();

                const createdAtText = result.created_at
                    ? result.created_at.replace("T", " ").substring(0, 16)
                    : "";

                const workDateText = result.work_date
                    ? result.work_date.replace("T", " ").substring(0, 10)
                    : "";

                const newHtml = `
    <a class="site-card" href="/site/write/${result.id}">
        <div class="site-name">${result.site_name} 현장</div>
        <div class="site-info">
            <span>작업일자 :</span>
            <span>${workDateText}</span>
        </div>
        <div class="site-info">
            <span>작성일시 :</span>
            <span>${createdAtText}</span>
        </div>
        <div class="go-write">작성하러 가기 →</div>
    </a>
`;

                $("#siteListBox").prepend(newHtml);
                $("#siteNameInput").val("");
            },
            error: function (xhr, status, error) {
                console.log("ajax error:", xhr, status, error);
                alert("현장 추가 중 오류가 발생했습니다.");
            }
        });
    });
});