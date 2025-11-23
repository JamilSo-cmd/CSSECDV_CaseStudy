$(document).ready(function () {
    
    const userID = currentUser._id;
    
    fetch('/userData',{// gets user Data from backend
        headers: {
            'userID': userID
        }
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.status);
            if (data.status === 401){
                alert("Please login first");
                window.location.replace("/login");
            }

            if (data.length > 0) { 
                const user = data[0]; 
                
                // Display Current profile picture
                document.getElementById('profilePic').src = user.profilePic;

                // Updates profile info in HTML based on fetch
                document.getElementById('usernameInput').value = user.username;
                document.getElementById('profilePicInput').value = user.profilePic;
                document.getElementById('genderInput').value = user.gender;
                document.getElementById('dlsuIDInput').value = user.dlsuID;
                document.getElementById('descInput').value = user.description;
                console.log("Retreived relevant user data");
            } else {
                console.error('No user data available.');
            }
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
        });

});