$(document).ready(function () {
    $.get("/userListData", function (users) {
        let table = `
            <table class="userTable">
                <thead style="position: sticky; top: 0; background-color: #f2f2f2; z-index: 1;">
                    <tr>
                        <th class="tableRow">Username</th>
                        <th class="tableRow">Gender</th>
                        <th class="tableRow">ID</th>
                        <th class="tableRow">Role</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(user => {
            table += `
                <tr>
                    <td class="tableRow">${user.username}</td>
                    <td class="tableRow">${user.gender}</td>
                    <td class="tableRow">${user.dlsuID}</td>
                    <td class="tableRow">${user.dlsuRole}</td>
                </tr>
            `;
        });

        table += `
                </tbody>
            </table>
        `;

        $(".postBody").html(table).css({
            width: "100%",
            height: "600px",
            overflowY: "auto",
            boxSizing: "border-box"
        });
    });
});