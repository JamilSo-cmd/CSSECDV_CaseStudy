$(document).ready(function () {
    
    // Fetch user list from server
    $.get("/userListData", function (users) {

        // Create table and header
        let table = `
            <table class="userTable">
                <tr>
                    <th>Username</th>
                    <th>Gender</th>
                    <th>ID</th>
                    <th>Role</th>
                </tr>
        `;

        // Add rows from user list
        users.forEach(user => {
            table += `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.gender}</td>
                    <td>${user.dlsuID}</td>
                    <td>${user.role}</td>
                </tr>
            `;
        });

        table += `</table>`;

        // Insert the table into the body
        $(".postBody").html(table);

    });

});