$(document).ready(function () {

    var targetID = 0;

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
                <tr data-user='${JSON.stringify(user)}'>
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
            const user = $(this).closest("tr").data("user");

            targetID = user._id;
            $("#editUsername").val(user.username);
            $("#editDlsuID").val(user.dlsuID);
            $("#editGender").val(user.gender);
            $("#editRole").val(user.dlsuRole);
            $("#editEmail").val(user.email || "");
            $("#editProfilePic").val(user.profilePic || "");
            $("#editDescription").val(user.description || "");

            $("#editModal, #modalOverlay").show();
        });

        $("#editDlsuID").on("input", function () {
            this.value = this.value.replace(/\D/g, ''); // remove non-digits
        });

        // Close modal
        $("#closeModal, #modalOverlay").on("click", function () {
            $("#editModal, #modalOverlay").hide();
        });
        
        // Handle form submission
        $("#editUserForm").on("submit", function (e) {
            e.preventDefault();

            const userId = targetID;
             const updatedUser = {
                username: $("#editUsername").val(),
                dlsuID: $("#editDlsuID").val(),
                gender: $("#editGender").val(),
                dlsuRole: $("#editRole").val(),
                email: $("#editEmail").val(),
                profilePic: $("#editProfilePic").val(),
                description: $("#editDescription").val()
            };
            $.ajax({
                url: `/updateUser/${userId}`,
                method: "POST",
                data: updatedUser,
                success: function (res) {
                    alert("User updated!");
                    window.location.href = '/userList';
                },
                error: function (err) {
                    alert("Failed to update user.");
                }
            });
        });

        $(".postBody").on("click", ".deleteBtn", function () {
            const user = $(this).closest("tr").data("user");
            targetID = user._id;
            if (confirm(`Are you sure you want to delete ${user.username}?`)) {
                $.ajax({
                    url: `/deleteUser/${targetID}`,
                    method: "DELETE",
                    success: function (res) {
                        alert(`user has been deleted.`);
                        window.location.href = '/userList';
                    },
                    error: function (err) {
                        alert("Failed to delete user.");
                    }
                });
            }
        });
    });
});
