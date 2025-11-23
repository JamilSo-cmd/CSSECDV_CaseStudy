$(document).ready(function () {
    
    var userID = new URLSearchParams(window.location.search).get('userID');
    var userPostCount = 0;
    if(userID == null){
        try{
            userID = currentUser._id;
        }catch(error){
            console.log("no ID recieved")
        }
    }
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

            if (data.length > 0) { 
                const user = data[0]; 
                
                // Updates profile info in HTML based on fetch
                console.log('profile name is: ' + user.username);
                document.getElementById('profileName').textContent = user.username;
                document.getElementById('profilePic').src = user.profilePic;
                document.getElementById('profileID').textContent = user.dlsuID;
                document.getElementById('profileRole').textContent = user.dlsuRole;
                document.getElementById('profileGender').textContent = user.gender;
                document.getElementById('descText').text = user.description;

                userID = String(user._id);

            } else {
                console.error('No user data available.');
            }
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
        });

    
    // for the 3 most recent posts of the user to be displayed
    $.get("/posts", function(data, status){

        data.forEach((post,x) => {
            
            if(post.authorID == userID &&
                userPostCount < 3) {
                const newPost= $("#postTemplate").clone();
                newPost.attr('id',"");

                fetch('/userData', {
                    headers: {
                        'userID': post.authorID
                    }
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.length > 0) { 
                            const user = data[0]; 
                            
                            newPost.find(".username").text(user.username);
                            newPost.find(".icon").attr("src", user.profilePic);
                            
                        } else {
                            console.error('No user data available.');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching user data:', error);
                    });

                    newPost.attr('id',"");
                    newPost.find(".username").attr('href', '/profile?userID=' + post.authorID);
                    newPost.find(".viewPostLink").attr('href', '/viewpost?postID=' + String(post._id));
                    newPost.find(".date").text(post.date);
                    newPost.find(".subject").text(post.subject);
                    newPost.find(".message").text(post.message);
                    newPost.find("#likes").text(post.likes);
                    newPost.find("#dislikes").text(post.dislikes);
                    newPost.find(".pageNum").text("page "+ (data.length-x));

                $(".userPostWindow").prepend(newPost); 
                userPostCount++; 
            }

        });

        // if there were no posts by the user in the profile or userToView was not set
        if(userPostCount == 0 ||
            !userID) {
            console.log('no posts by user found');
            document.getElementById('postTemplate').remove(); // removes the template
        }

        console.log('User had: ' + userPostCount + ' posts');

        // set the link to "more posts by user" to the send the userID of the current profile
        document.getElementById('toUserPosts').setAttribute('href', '/userPosts?userID=' + userID);

        $(".userPostWindow").append("<div  class='postFooter' style='color: rgb(96, 96, 96);'><p>end of recent history</p></div>");

    });

});