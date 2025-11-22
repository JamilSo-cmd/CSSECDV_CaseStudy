$(document).ready(function () {
    
    const userID = new URLSearchParams(window.location.search).get('userID');
    console.log(userID);
    // gets user Data from backend
    fetch('/userData', {
        headers: {
            'userID': userID
        }
    })
        .then(response =>response.json())
        .then(data => {
            console.log(data.status);

            if (data.status === 401){
                alert("Please login first");
                window.location.replace("/login");
            }

    
        });

});