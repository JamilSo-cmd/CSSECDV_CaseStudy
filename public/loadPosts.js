$(document).ready(function () {
    
    $.get("/posts", function(data, status){

        data.forEach((post,x) => {
            
            console.log(post);

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
            
        });

        $(".postWindow").append("<div  class='postFooter' style='color: rgb(96, 96, 96);'><p>end of recent history</p></div>");

    });

    $.get('/categories',function(data,status){
        
        data.forEach(post => {
            $("#categoryFilter").append("<option value="+post+">"+post+"</option>");

        });
    });

    $.get('/trending', function(data,status){


        data.forEach((post,x) => {

            console.log(x);
            
            if(x < 5){
                const newTrend= $("#trendTemplate").clone();

                fetch('/userData', {
                    headers: {
                        'userID': post.authorID
                    }
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.length > 0) { 
                            const user = data[0]; 
                                                
                            newTrend.find(".username").text(user.username);
                            newTrend.find(".icon").attr("src", user.profilePic);
                        } else {
                            console.error('No user data available.');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching user data:', error);
                    });

                newTrend.attr('id',"");


                newTrend.find(".viewPostLink").text(post.subject);
                newTrend.find(".viewPostLink").attr('href', 'viewpost.html?postID=' + String(post._id));
                newTrend.find(".username").attr('href', 'profile.html?userID=' + post.authorID);
                newTrend.find(".date").text(post.date);
                newTrend.find(".likes").text(post.likes);
                newTrend.find(".dislikes").text(post.dislikes);

                $(".trendPanel").append(newTrend);  
            }
            
        });

    });
    

    $('#submitButton').on('click', function(){

        var queryStr = $('#searchStr').val();
        var sortStr = $('#sortFilter').val();
        var tagStr = $('#categoryFilter').val();
        console.log(queryStr);

        $.get('/filter?search='+ queryStr + '&sort=' + sortStr + '&category=' + tagStr , function(data, status){
            console.log(data);

            $('.postWindow').empty();

            data.forEach((post,x) => {
            
            console.log(post);

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
        });
        $(".postWindow").append("<div  class='postFooter' style='color: rgb(96, 96, 96);'><p>end of recent history</p></div>");
        });

    })

});
     

