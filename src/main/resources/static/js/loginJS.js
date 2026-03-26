$("#loginForm").on("submit", function (event) {

    event.preventDefault();

    const id = $("#id").val();
    const password = $("#password").val();


    if (id === "") {
        alert("아이디를 입력해주세요.")
        return false;
    }else if(password === "") {
        alert("비밀번호를 입력해주세요.")
        return false;
    }

    $.ajax({
        method: "POST",
        url: "/loginCheck",
        data: {id: id, password: password},
        dataType: "json",
        success: function (result) {

            if (result === 0) {
                alert("아이디나 비밀번호가 일치하지 않습니다.");
                return false;
            }

            location.href = "/loginOk";
        },
        error: function (xhr, status, error) {
            alert(xhr.responseText);
            alert(error);
            return false;
        }
    })
})