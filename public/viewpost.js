$(document).ready(function () {
    
    const postID = new URLSearchParams(window.location.search).get('postID');
    const userID = new URLSearchParams(window.location.search).get('userID');
    console.log('postID to view is: ' + postID);

        // does most things for viewPost when it comes to the post itself
        async function loadViewPost() {
            try {
                const responsePost = await fetch('/onePost', {
                    headers: {
                        'postID': postID
                    }
                })
                const postData = await responsePost.json();

                /*$.get('/updateLikes?postID=' + postData[0]._id, function(data, status){
                    
                })*/
            
                console.log('post id is : ' + postData[0]._id);
                // updates content of post based on post data
                document.getElementById('postID').value = postData[0]._id;
                document.getElementById('viewPostTitle').textContent = postData[0].subject;
                document.getElementById('viewPostBody').textContent = postData[0].message;
                document.getElementById('likeCount').textContent = postData[0].likes;
                document.getElementById('dislikeCount').textContent = postData[0].dislikes;
                document.getElementById('posterDate').textContent = postData[0].date;
                document.getElementById('editLink').href = "/editPost?postID="+postData[0]._id;
                document.getElementById('likeButton').setAttribute("onclick" ,"likeThis('" + postData[0]._id + "', 1)");
                document.getElementById('dislikeButton').setAttribute("onclick" ,"likeThis('" + postData[0]._id + "', -1)");

                //to show/hide edit button
                try{    
                    const responseUser = await fetch('/userData', {
                        headers: {
                            'userID': userID
                        }
                    })

                    const userData = await responseUser.json();
                    console.log(userData);  
                    
                    console.log(currentUser)
                    //TODO: fix admin
                    if (String(currentUser._id) === String(postData[0].authorID) || currentUser.dlsuRole === "admin"){
                        $(".post").find(".editButton").show();
                    }
                    if (userData){
                        document.getElementById('authorID').value = userData[0]._id;
                        $(".postWindow").find("#loginmessage").text("Type comment here");

                    }
                }
                catch{
                }
                //fetch authorData
                const responsePoster = await fetch('userData', {
                    headers: {
                        'userID': postData[0].authorID
                    }
                })
                const posterData = await responsePoster.json();
                document.getElementById('posterPic').src = posterData[0].profilePic;
                document.getElementById('posterUsername').textContent = posterData[0].username;
                document.getElementById('posterUsername').href = ('/profile?userID=' + posterData[0]._id);

            } catch (error) {
                console.error("post loading error: ", error);
            }
        }

        loadViewPost();  
        
        // loads comments of post
        $.get("/comments", function(data, status){

            data.forEach((comment,x) => {
                /*$.get('/updateLikes?postID=' + String(comment._id), function(data, status){
                    
                })*/

                // if the postID of the comment matches the current post being viewed
                if(comment.postID == postID){
                    console.log(comment);
        
                    const newComment= $("#commentTemplate").clone();
                    // fetches user data of the comment author
                    fetch('/userData', {
                        headers: {
                            'userID': comment.authorID
                        }
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.length > 0) { 
                                const user = data[0]; 
                                
                                newComment.attr("id",'');  
                                newComment.find(".commentIcon").attr('src', user.profilePic);  
                                newComment.find(".username").text(user.username);                         
                            } else {
                                console.error('No user data available.');
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching user data:', error);
                        });

                    const commentObjID = comment._id;
        
                    newComment.find(".comment").text(comment.comment);
                    newComment.find(".commentDate").text(comment.date);
                    newComment.find(".username").attr('href', '/profile?userID=' + String(comment.authorID));
                    newComment.find(".likeButton").attr("onclick" ,"likeThis('" + commentObjID + "', 1)");
                    newComment.find(".dislikeButton").attr("onclick" ,"likeThis('" + commentObjID + "', -1)");
                    newComment.find(".commentLikeCount").text(comment.likes);
                    newComment.find(".commentDislikeCount").text(comment.dislikes);
        
                    $(".postFooter").prepend(newComment); 
                    }
                
            });
            //$(".postWindow").append("<div  class='postFooter' style='color: rgb(96, 96, 96);'><p>end of recent history</p></div>");
    
        });
    
});