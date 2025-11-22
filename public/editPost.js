$(document).ready(function () {
    
    const postID = new URLSearchParams(window.location.search).get('postID');
    
    async function loadViewPost() {
        try {
            const responsePost = await fetch('/onePost', {
                headers: {
                    'postID': postID
                }
            })
            const postData = await responsePost.json();

            console.log('post id is : ' + postData[0]._id);

            document.getElementById('curSubject').value = postData[0].subject;
            document.getElementById('curMsg').value = postData[0].message;
            document.getElementById('keySubject').value = postData[0].subject;
            document.getElementById('keyMsg').value = postData[0].message;
            document.getElementById('subject').value = postData[0].subject;
            document.getElementById('message').value = postData[0].message;
            document.getElementById('tag').value = postData[0].tag;
        } 
        catch (error) {
            console.error("post loading error: ", error);
        }

    }

    loadViewPost();

});