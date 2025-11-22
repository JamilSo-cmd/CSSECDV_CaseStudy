import express from 'express';
import path from 'path';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { ObjectId } from 'mongodb';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: './secrets.env' });

// unique ID generation for sessions
import {v4 as uuidv4} from 'uuid';

const app = express();
const port = process.env.PORT;
const __dirname = path.resolve();
const saltRounds = 10;

// initialize session (WIP)
app.use(session(
  { name:'SessionCookie',
    genid: function(req) {
      //console.log('Generated session id');
      return uuidv4();
    },
    secret: 'secretpass',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 3600 * 1000 }
  }));

var curUser; // should be a user

app.use(express.urlencoded({ extended: true })); // Add this line for form data

// MongoDB connection setup
const uri = process.env.MONGODB_CONN;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  }
});

async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1); // Exit the process if there's an error connecting to MongoDB
  }
}

// Initialize MongoDB connection
connectToMongoDB();


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});


app.use('/', express.static('public', {index: "index.html"}))

app.get('/index', (req, res) =>{

  res.sendFile('./public/index.html', { root: __dirname });

});

// gets posts
app.get('/posts', async (req,res) =>{

  const postCollection = client.db("ForumsDB").collection("Posts");

  // Execute query 
  const cursor = postCollection.find();
  
  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }

  const array =  await cursor.toArray();

  res.status(200).json(array);
  
});

// gets comments
app.get('/comments', async (req,res) =>{

  const commCollection = client.db("ForumsDB").collection("Comments");

  // Execute query 
  const cursor = commCollection.find();
  
  // Print a message if no documents were found
  if ((commCollection.countDocuments()) === 0) {
    console.log("No comment documents found!");
  }

  const array =  await cursor.toArray();

  console.log('sending comments');
  res.status(200).json(array);
  
});

app.post('/postComment', async (req,res) =>{

  const commentCollection = client.db("ForumsDB").collection("Comments");
  const date = new Date(Date.now()).toUTCString();
  
  const {comment,postID,authorID} = req.body;
  const result = await commentCollection.insertOne({
    comment:comment,
    date:date,
    authorID:authorID,
    postID:postID,
    dislikes: 0,
    likes: 0,
  });
  res.redirect("/viewpost.html?postID="+postID);

});

// gets likes
app.get('/likes', async (req,res) =>{

  const likeCollection = client.db("ForumsDB").collection("Likes");

  // Execute query 
  const cursor = likeCollection.find();
  
  // Print a message if no documents were found
  if ((likeCollection.countDocuments()) === 0) {
    console.log("No comment documents found!");
  }

  const array =  await cursor.toArray();

  console.log('sending comments');
  res.status(200).json(array);
  
});

// for when a user sends a like or a dislike
app.get('/like', async (req,res) =>{
  // like values are '1', dislike values are '-1'
  console.log(req.query.postID);

  if(req.query.postID && req.session.userInfo) { // if user is logged in and header is provided
    const likeCollection = client.db("ForumsDB").collection("Likes");
    const postCollection = client.db("ForumsDB").collection("Posts");
    const commCollection = client.db("ForumsDB").collection("Comments");
    var likeValue = 1; // assumes it is a like instead of a dislike before it gets any header value
    var likerID = String(req.session.userInfo._id);
    var postID = req.query.postID
    var postObjID = new ObjectId(postID);
    var postTarget = await postCollection.findOne({_id: postObjID});

    console.log('found a post to like, likeValue is: ' + likeValue);
    
    if(req.query.likeValue) { // if there is a header value
      console.log('Received a like/dislike value');
      likeValue = req.query.likeValue;
    }

    // var likeToSend = await likeCollection.findOne({ likerID: likerID, postID: postID });

    // if(likeToSend) { // if the user has liked/disliked the post before

    console.log('User has already liked/disliked this post, updating value');
    const filter = { likerID: likerID, postID: postID };
    const updates = {like:likeValue};
    
    // Update the user document with the accumulated updates
    await likeCollection.updateOne(filter, { $set: updates },{upsert:true});

    // }
    // else { // if the user has not liked/disliked the post before
    //   console.log('User has never liked/disliked this post before, creating new document');
    //   await likeCollection.insertOne({ // inserts a new like/dislike
    //     postID: postID,
    //     like: likeValue,
    //     likerID: likerID
    //   });

    // }

    const newLikeCollection = client.db("ForumsDB").collection("Likes");
    const cursor = newLikeCollection.find({postID: postID}); // finds all likes that have a matching postID
    const likeArray = await cursor.toArray();
    // update post or comment with the appropriate amount of likes/dislieks (WIP)

    if(postTarget) { // if the like was targeted to a post
      // set the post's likes and dislikes to 0
      await postCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
      await postCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

      let likes = 0;
      let dislikes = 0;
      // iterate through each like/dislike that matches with the postID target
      likeArray.forEach((likeDocument) => {
        if(likeDocument.like == '1') {
          likes++;
        }
        else if(likeDocument.like == '-1') {
          dislikes++;
        }
      }) 

      const postCursor = await postCollection.findOneAndUpdate({_id: postObjID}, {$set: {likes, dislikes}},{returnDocument:'after'})
      
      console.log(postCursor);
      return res.status(200).json(postCursor);
      
    }
    else {
      postTarget = await commCollection.findOne({_id: postObjID});
      if(postTarget) { // if the like was not targeted to a comment
        // set the comment's likes and dislikes to 0
        await commCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
        await commCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

        likeArray.forEach((like) => {
          if(like.like == '1') {
            console.log('logged a like');
            commCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
          } else if (like.like == '-1') {
            console.log('logged a dislike');
            commCollection.updateOne({_id: postObjID}, {$inc: {dislikes: 1}})
          }
        })

      }

    }
  
    // const postCursor = await postCollection.findOne({_id:postObjID}); 
    // console.log('logged a dislike');
    // const postCursor = await postCollection.findOneAndUpdate({_id: postObjID}, {$inc: {dislikes: 1}})
    // console.log(postCursor);
          
    // return res.status(200).json(postCursor);
  }
      else {
    console.log('Like request failed');
    return res.status(404).json({ message: "Like request failed" });
  }
});

// updates likes and dislikes value of a post/comment based on what is on 'Likes' collection of the db (WIP, experimental)
app.get('/updateLikes', async (req, res) => {

  if(req.query.postID) {
    const likeCollection = client.db("ForumsDB").collection("Likes");
    const postCollection = client.db("ForumsDB").collection("Posts");
    const commCollection = client.db("ForumsDB").collection("Comments");
    var postID = req.query.postID;
    var postObjID = new ObjectId(postID);
    var postTarget = await postCollection.findOne({_id: postObjID});
    const cursor = likeCollection.find({postID: postID}); // finds all likes that have a matching postID
    const likeArray = await cursor.toArray();

    if(postTarget) { // if the like was targeted to a post
      // set the post's likes and dislikes to 0
      await postCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
      await postCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

      // iterate through each like/dislike that matches with the postID target
      likeArray.forEach((like) => {
        if(like.like == '1') {
          console.log('logged a like');
          postCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
        }
        else if(like.like == '-1') {
          console.log('logged a dislike');
          postCollection.updateOne({_id: postObjID}, {$inc: {dislikes: 1}})
        }
      }) 
    }
    else {
      postTarget = await commCollection.findOne({_id: postObjID});
      if(postTarget) { // if the like was not targeted to a comment
        // set the comment's likes and dislikes to 0
        await commCollection.updateOne({_id: postObjID}, {$set: {likes: 0}})
        await commCollection.updateOne({_id: postObjID}, {$set: {dislikes: 0}})

        likeArray.forEach((like) => {
          if(like.like == '1') {
            console.log('logged a like');
            commCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
          } else if (like.like == '-1') {
            console.log('logged a dislike');
            commCollection.updateOne({_id: postObjID}, {$inc: {dislikes: 1}})
          }
        })
    }}


  }
  else {
    console.log('no postID given to update for');
    return res.status(404).json({ message: "Post not found." });
  }
})

app.get('/trending',async (req,res)=> {

  const postCollection = client.db("ForumsDB").collection("Posts");
  
  // Execute query 
  const cursor = postCollection.find().sort({likes:-1});
  
  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }

  const array =  await cursor.toArray();

  res.status(200).json(array);
  

});

// gets a single post (WIP)
app.get('/onePost', async (req,res) =>{

  try{
    const postCollection = client.db("ForumsDB").collection("Posts");
    var postID = req.header('postID');
    var postObjID = new ObjectId(postID);

    console.log('Received post ID: ' + postID);

    // Execute query 
    var postToSend = await postCollection.findOne({ _id: postObjID });

    console.log('post found to send has the subject of: ' + postToSend.subject);
    
    const postData = [{
      '_id': postToSend._id, 
      'subject': postToSend.subject,
      'message': postToSend.message,
      'tag': postToSend.tag,
      'date': postToSend.date,
      'dislikes': postToSend.dislikes,
      'likes': postToSend.likes,
      'authorID': postToSend.authorID
    }];

    // sends post back
    if(postData) {
      console.log("post sent");
      res.json(postData);
    }
    else {
      console.error('Error finding post to send back', error);
      return res.status(404).json({ message: "Post not found." });
    }

  } catch (error) {
    console.log("Error locating single post", error);
  }

});

// gets a single comment
app.get('/oneComment', async (req,res) =>{

  try{
    const commCollection = client.db("ForumsDB").collection("Comments");
    var commID = req.header('commID');
    var commObjID = new ObjectId(commID);

    console.log('Received comment ID: ' + commID);

    // Execute query 
    var commToSend = await commCollection.findOne({ _id: commObjID });

    console.log('comment found to send has the subject of: ' + commToSend.comment);
    
    const commData = [{
      '_id': commToSend._id,
      'comment': commToSend.comment,
      'date': commToSend.date,
      'authorID': commToSend.authorID
    }];

    // sends comment back
    if(commData) {
      console.log("comment sent");
      res.json(commData);
    }
    else {
      console.error('Error finding comment to send back', error);
      return res.status(404).json({ message: "Comment not found." });
    }

  } catch (error) {
    console.log("Error locating single comment", error);
  }

});

app.get('/categories',async (req,res)=>{

  const postCollection = client.db("ForumsDB").collection("Posts");

  // Execute query 
  const cursor = await postCollection.distinct("tag");

  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }
  
  res.status(200).json(cursor);
  
});

//in progress (trying to fix query)
app.get('/filter', async (req, res) => {

  const postCollection = client.db("ForumsDB").collection("Posts");
  const searchStr = req.query.search;
  const sortStr = req.query.sort;
  const categoryStr = req.query.category;

  console.log("looking for: "+searchStr)
  console.log("sorted  by:  "+sortStr)
  console.log("with category: "+categoryStr)
  console.log("----------------------------")

  const query = {
    subject:{$regex:searchStr},
    tag:{$regex:categoryStr}
  }

  //sort by newest
  let sort = {};

  if (sortStr == "Alphabetical"){

    sort = {subject:-1}

  }
  else if (sortStr == "Oldest"){

    sort = {_id:-1}

  }


  // Execute query 
  const cursor = postCollection.find(query).collation({'locale':'en'}).sort(sort);

  // Print a message if no documents were found
  if ((postCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }

  const array =  await cursor.toArray();

  
  res.status(200).json(array);
})

app.get('/login', (req, res) =>{
  res.sendFile('./public/login.html', { root: __dirname });

});

// Handle editing profile and validation that username is unique (WIP)
app.post('/editProfile', async (req, res) => {
  try {
    console.log("edit Profile function started");
    const { usernameInput, profilePicInput, genderInput, dlsuIDInput, roleInput, descInput } = req.body;
    const usersCollection = client.db("ForumsDB").collection("Users");
    const user = await usersCollection.findOne({ username: curUser.username });

    if (!user) {
      console.error("User editing error: User not found");
      return res.status(404).json({ message: "User not found." });
    } else {
      if (usernameInput) {
        // Check if the new username already exists in the database
        const existingUser = await usersCollection.findOne({ username: usernameInput });
        if (existingUser && existingUser.username !== curUser.username) {
          console.error("User editing error: Username already exists");
          return res.status(400).json({ message: "Username already exists." });
        }
      }

      const filter = { username: curUser.username };
      const updates = {};

      if (usernameInput) {
        updates.username = usernameInput;
      }
      if (profilePicInput) {
        updates.profilePic = profilePicInput;
      }
      if (genderInput) {
        updates.gender = genderInput;
      }
      if (dlsuIDInput) {
        updates.dlsuID = dlsuIDInput;
      }
      if (roleInput) {
        updates.dlsuRole = roleInput;
      }
      if (descInput) {
        updates.description = descInput;
      }

      // Update the user document with the accumulated updates
      await usersCollection.updateOne(filter, { $set: updates });

      // Update curUser with the new profile information
      if (curUser) {
        if (usernameInput) curUser.username = usernameInput;
        if (profilePicInput) curUser.profilePic = profilePicInput;
        if (genderInput) curUser.gender = genderInput;
        if (dlsuIDInput) curUser.dlsuID = dlsuIDInput;
        if (roleInput) curUser.dlsuRole = roleInput;
        if (descInput) curUser.description = descInput;
      }

      console.log("User profile updated successfully");
      return res.redirect('/profile.html');
      
      
    }
  } catch (error) {
    console.error("Error occurred during editing of profile info", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Handle logging in and validation that user exists in DB
app.post('/login', async (req, res) => {
  try {
    // Extract email and password from the request body
    const { email, password } = req.body;

    // Make sure email and password are provided
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // 'users' collection in MongoDB database
    const usersCollection = client.db("ForumsDB").collection("Users");

    // Find user with the provided email and password
    const user = await usersCollection.findOne({ email: email});

    const match = await bcrypt.compare(password,user.password);
    
    if (!match) {
      return res.redirect('/login.html?error=invalid_credentials');
    }
    

    // If authentication successful, redirect to profile page or dashboard
    curUser = user; // assigns global variable to the user who just logged in
    req.session.userInfo = user; // sets session userInfo to be user who just logged in (WIP)
    console.log('User logged in: ' + req.session.userInfo.username); // to see if the username was gotten correctly
    return res.redirect('/index.html'); // Change the redirect URL as needed

  } catch (error) {
    console.error("Error occurred during login:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// function for getting profile info
app.get('/userData', async (req, res) => {

  let userID = req.header('userID');
  
  if (userID === null || userID === "null"){
    try{
      userID = req.session.userInfo._id;
    }
    catch(err){
      console.log("Cannot read user id");
    }
    if (userID === null || userID === "null"){
      console.log(true);
      return res.status(401).json({message:"No logged in user found",status:401});
    }
  }
  if(userID){
    
    try{
      const usersCollection = client.db("ForumsDB").collection("Users");
  
      /*if(req.header('userToView')) { // if userToView was sent in header, should be a String
        var userToView = req.header('userToView');
        var userToSend = await usersCollection.findOne({ username: userToView });
        console.log('sending user based on userToView');
      }
      else */ // if userID was sent in header, should be a String
      var userToSend = await usersCollection.findOne({ _id: new ObjectId(userID) });
      
      // if no user was found
      if(!userToSend) {
        console.log('No valid user found');
        return res.status(404).json({ message: "User not found or could not be deleted." });
      }
  
      const userData = [{
        '_id': userToSend._id,
        'username': userToSend.username,
        'profilePic': userToSend.profilePic,
        'dlsuID': userToSend.dlsuID,
        'dlsuRole': userToSend.dlsuRole,
        'gender': userToSend.gender,
        'description': userToSend.description
      }];
      
      if(userData) {
        res.json(userData);
      }
    } catch (error) {
      console.error("Error locating the user");
    }

  }  

  
})

app.get('/profile', (req, res) =>{

  res.sendFile('./public/profile.html', { root: __dirname });

});

app.get('/create',(req, res) =>{
    res.sendFile('./public/create.html', { root: __dirname });
  }
);

// registers posts into the db
app.post('/create', async (req,res) => {
  
  try{

    let userID = req.session.userInfo;
    console.log(req.session.userInfo);

    const {subject,message,tag} = req.body;

    if (!subject || !message || !tag){
      return res.redirect('/create');
    }
    
    const date = new Date(Date.now()).toUTCString();

    const postsCollection = client.db("ForumsDB").collection("Posts");

    const result = await postsCollection.insertOne({
      author:userID.username,
      authorPic:curUser.profilePic,
      subject:subject,
      message:message,
      tag:tag,
      date:date,
      dislikes: 0,
      likes: 0,
      authorID:curUser._id.toString(),
    });

    console.log("test");

    res.redirect("/index");

  }
  catch(error){
      console.error("Error occurred during post creation.", error);
      return res.status(500).json({ message: "Internal server error." });
  }

});

app.post('/delete', async (req, res) => {
  try {

    const {keyMsg,keySubject} = req.body;

    // Get the Posts collection from the database
    const postsCollection = client.db("ForumsDB").collection("Posts");

    // Delete the post with the provided post ID
    const result = await postsCollection.deleteOne({subject:keySubject,message:keyMsg});

    // Check if the post was deleted successfully
    if (result.deletedCount === 1) {
      console.log("Post deleted successfully");
      return res.redirect('/index.html');
    } else {
      return res.status(404).json({ message: "Post not found or could not be deleted." });
    }
  } catch (error) {
    console.error("Error occurred during post deletion:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});


app.get('/signup', (req, res) =>{

  res.sendFile('./public/signup.html', { root: __dirname });

});

// Handle registering users to the DB
app.post('/signup', async (req, res) => {
  try {
      // Extract email, username, and password from the request body
      const { email, username, password } = req.body;
      
      // Make sure all required fields are provided
      if (!email || !username || !password) {
          return res.status(400).json({ message: "Email, username, and password are required." });
      }

      const hashedPassword = await new Promise((resolve, reject) => {
        bcrypt.hash(password, saltRounds, function(err, hash) {
          if (err) reject(err)
          resolve(hash)
        });
      })

      // 'users' collection in MongoDB database
      const usersCollection = client.db("ForumsDB").collection("Users");

      // Insert the user data into the database
      const result = await usersCollection.insertOne({
          email: email,
          username: username,
          password: hashedPassword,
          profilePic: "https://news.tulane.edu/sites/default/files/headshot_icon_0.jpg",
          description: "",
          dlsuID: "",
          dlsuRole: "",
          role:"member",
          gender: ""
      });

      // If insertion is successful, respond with a success message
      if (result.insertedCount === 1) {
          return res.redirect('/login.html'); // Redirect to login page
      } else {
          // If insertion failed for some reason
          return res.redirect('/login.html'); // Redirect to login page
      }
  } catch (error) {
      console.error("Error occurred during signup:", error);
      return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/editPost', (req, res) =>{

  res.sendFile('./public/editPost.html', { root: __dirname });

});

app.post('/editPost', async (req, res) => {
  try {

    // Extract subject and message from the request body
    const {curSubject,curMsg,subject, message, tag } = req.body;
    // Check if postId, subject, and message are provided
    if (!subject || !message || !tag) {
      return res.status(400).json({ message: "Post ID, subject, and message are required." });
    }

    // Get the Posts collection from the database
    const postsCollection = client.db("ForumsDB").collection("Posts");

    const filter = {subject:curSubject,message:curMsg};
    const updates = {};

    if (subject) {
      updates.subject = subject;
    }
    if (message) {
      updates.message = message;
    }
    if (tag) {
      updates.tag = tag;
    }

    // Update the post with the provided post ID
    const result = await postsCollection.updateOne(filter,{$set:updates});

    // Check if the post was updated successfully
    if (result.modifiedCount === 1) {
      console.log("Post edited successfully");
      return res.redirect('/index.html');
    } else {
      return res.status(404).json({ message: "Post not found or could not be updated." });
    }
  } catch (error) {
    console.error("Error occurred during post editing:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});


app.get('/editProfile', (req, res) =>{

  res.sendFile('./public/editProfile.html', { root: __dirname });

});

app.get('/viewpost', (req, res) =>{

  res.sendFile('./public/viewpost.html', { root: __dirname });

});

app.post('/viewpost', (req, res) =>{

  res.sendFile('./public/viewpost.html', { root: __dirname });

});

app.get('/about', (req, res) =>{

  res.sendFile('./public/about.html', { root: __dirname });

});