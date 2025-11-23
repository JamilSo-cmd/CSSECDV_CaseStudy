$(document).ready(function () {
    $.get("/userListData", function (users) {
        let table = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background-color: #f2f2f2; z-index: 1;">
                    <tr>
                        <th class="tableRow">Username</th>
                        <th class="tableRow">Gender</th>
                        <th class="tableRow">ID</th>
                        <th class="tableRow">Role</th>
                        <th class="tableRow">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(user => {
            table += `
                <tr data-id="${user.dlsuID}">
                    <td class="tableRow">${user.username}</td>
                    <td class="tableRow">${user.gender}</td>
                    <td class="tableRow">${user.dlsuID}</td>
                    <td class="tableRow">${user.dlsuRole}</td>
                    <td class="tableRow" style="display: flex; gap: 5px;">
                        <button class="editBtn" style="padding: 4px 8px;">Edit</button>
                        <button class="deleteBtn" style="padding: 4px 8px; background-color: #e74c3c; color: white;">Delete</button>
                    </td>
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

        // Attach click handlers for dynamic rows
        $(".postBody").on("click", ".editBtn", function () {
            const row = $(this).closest("tr");
            const userId = row.data("id");
            const username = row.find("td:nth-child(1)").text();
            const gender = row.find("td:nth-child(2)").text();
            const role = row.find("td:nth-child(4)").text();

            $("#editUserId").val(userId);
            $("#editUsername").val(username);
            $("#editGender").val(gender);
            $("#editRole").val(role);

            $("#editModal, #modalOverlay").show();
        });

        // Close modal
        $("#closeModal, #modalOverlay").on("click", function () {
            $("#editModal, #modalOverlay").hide();
        });
        
        // Handle form submission
        $("#editUserForm").on("submit", function (e) {
            e.preventDefault();

            const userId = $("#editUserId").val();
            const updatedUser = {
                username: $("#editUsername").val(),
                gender: $("#editGender").val(),
                dlsuRole: $("#editRole").val()
            };

            $.ajax({
                url: `/updateUser/${userId}`,
                method: "POST",
                data: updatedUser,
                success: function (res) {
                    alert("User updated!");
                    $("#editModal, #modalOverlay").hide();

                    const row = $(`tr[data-id='${userId}']`);
                    row.find("td:nth-child(1)").text(updatedUser.username);
                    row.find("td:nth-child(2)").text(updatedUser.gender);
                    row.find("td:nth-child(4)").text(updatedUser.dlsuRole);
                },
                error: function (err) {
                    alert("Failed to update user.");
                }
            });
        });

        $(".postBody").on("click", ".deleteBtn", function () {
            const userId = $(this).closest("tr").data("id");
            const username = $(this).closest("tr").find("td:first").text();
            if (confirm(`Are you sure you want to delete ${username}?`)) {
                alert(`Deleted User with ID: ${userId}`);
                // TODO: Send delete request to server and remove row
            }
        });
    });
});
