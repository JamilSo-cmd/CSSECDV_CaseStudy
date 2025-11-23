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
            const userId = $(this).closest("tr").data("id");
            alert(`Edit User with ID: ${userId}`);
            // TODO: Open edit modal or redirect to edit page
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
