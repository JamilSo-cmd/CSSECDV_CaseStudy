$(document).ready(function () {
    
    // gets userToView from url, passed from previous profile.html
    const userID = new URLSearchParams(window.location.search).get('userID');
    console.log('User ID to view: '+ userID);

    $.get("/posts", function(data, status){

        data.forEach((post,x) => {
            
            if(post.authorID == userID) {
                console.log('found a post');
                const newPost= $("#postTemplate").clone();
                
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
                    newPost.find(".username").attr('href', 'profile.html?userID=' + post.authorID);
                    newPost.find(".viewPostLink").attr('href', 'viewpost.html?postID=' + String(post._id));
                    newPost.find(".date").text(post.date);
                    newPost.find(".subject").text(post.subject);
                    newPost.find(".message").text(post.message);
                    newPost.find("#likes").text(post.likes);
                    newPost.find("#dislikes").text(post.dislikes);
                    newPost.find(".pageNum").text("page "+ (data.length-x));

                $(".postWindow").prepend(newPost);  
            }

        });
        $(".postWindow").append("<div  class='postFooter' style='color: rgb(96, 96, 96);'><p>end of recent history</p></div>");

      });

     
});

