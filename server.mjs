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

app.use(express.urlencoded({ extended: true })); // Add this line for form data
app.use(express.json()); // Add this for JSON parsing

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

app.set("view engine", "ejs");
app.set("views", "views");

app.use('/', express.static('public', {index: "index"}))

app.get('/index', (req, res) =>{

  res.render("index")

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
  res.redirect("/viewpost?postID="+postID);

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

      likeArray.forEach((like) => {
        if(like.like == '1') {
          console.log('logged a like');
          postCollection.updateOne({_id: postObjID}, {$inc: {likes: 1}})
        } else if (like.like == '-1') {
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

      }

    }

  }

});

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

app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
      if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Internal server error." });
      }
      req.session.userInfo = null;
      res.clearCookie('SessionCookie'); // Clear the session cookie
      res.redirect('/login');
  });
});

// Handle editing profile and validation that username is unique (WIP)
app.post('/editProfile', async (req, res) => {
  try {
    console.log("edit Profile function started");
    const { usernameInput, profilePicInput, genderInput, dlsuIDInput, roleInput, descInput } = req.body;
    const usersCollection = client.db("ForumsDB").collection("Users");
    const sessionUser = req.session.userInfo;
    const user = await usersCollection.findOne({ username: sessionUser.username });

    if (!user) {
      console.error("User editing error: User not found");
      return res.status(404).json({ message: "User not found." });
    } else {
      if (usernameInput) {
        // Check if the new username already exists in the database
        const existingUser = await usersCollection.findOne({ username: usernameInput });
        if (existingUser && existingUser.username !== sessionUser.username) {
          console.error("User editing error: Username already exists");
          return res.status(400).json({ message: "Username already exists." });
        }
      }

      const filter = { username: sessionUser.username };
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

      // Update current user with the new profile information
      Object.assign(req.session.userInfo, updates);

      console.log("User profile updated successfully");
      return res.redirect('/profile');
      
      
    }
  } catch (error) {
    console.error("Error occurred during editing of profile info", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/userPosts', async (req,res) =>{

  let userID = req.header('userID');

  if(userID){
    try{
      const postCollection = client.db("ForumsDB").collection("Posts");
      // Execute query 
      const cursor = postCollection.find({authorID:userID});
    
      // Print a message if no documents were found
      if ((await postCollection.countDocuments({authorID:userID})) === 0) {
        console.log("No documents found!");
      }
    
      const array =  await cursor.toArray();
    
      res.status(200).json(array);
    }
    catch(error){
      console.error("Error locating user posts");
    }
  }
  
});

app.get('/login', (req, res) =>{

  res.render("login", { error: null });

});

// Handle login process with attempt tracking and lockout
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", { error: "Email and password are required." });
    }

    const usersCollection = client.db("ForumsDB").collection("Users");
    const user = await usersCollection.findOne({ email: email });

    if (!user) {
      return res.render("login", { error: "Invalid email or password." });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000);
      return res.render("login", { 
        error: `Account is locked. Please try again in ${remainingTime} seconds.`,
        lockout: true,
        remainingTime: remainingTime
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      // Increment failed login attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        updates.lockUntil = Date.now() + 30000; // Lock for 30 seconds
        updates.failedLoginAttempts = 0; // Reset counter after locking
        
        await usersCollection.updateOne(
          { email: email },
          { $set: updates }
        );

        return res.render("login", { 
          error: "Too many failed login attempts. Account locked for 30 seconds.",
          lockout: true,
          remainingTime: 30
        });
      }

      // Update failed attempts
      await usersCollection.updateOne(
        { email: email },
        { $set: updates }
      );

      const attemptsLeft = 5 - failedAttempts;
      return res.render("login", { 
        error: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`,
        attemptsLeft: attemptsLeft
      });
    }

    // Successful login - reset failed attempts and lock
    await usersCollection.updateOne(
      { email: email },
      { 
        $set: { failedLoginAttempts: 0 },
        $unset: { lockUntil: "" }
      }
    );

    // Set session and redirect
    req.session.userInfo = user;
    console.log("User logged in successfully");
    return res.redirect('/index');

  } catch (error) {
    console.error("Error occurred during login:", error);
    return res.render("login", { error: "Internal server error." });
  }
});

// Forgot password page
app.get('/forgot-password', (req, res) => {
  res.render("forgot-password", { step: 1, error: null });
});

// Handle forgot password - verify email and security question
app.post('/forgot-password', async (req, res) => {
  try {
    const { email, securityAnswer, newPassword, confirmPassword } = req.body;
    const usersCollection = client.db("ForumsDB").collection("Users");

    // Step 1: Verify email and show security question
    if (email && !securityAnswer) {
      const user = await usersCollection.findOne({ email: email });
      
      if (!user) {
        return res.render("forgot-password", { 
          step: 1, 
          error: "Email address not found." 
        });
      }

      // If user doesn't have a security question set, show error
      if (!user.securityQuestion || !user.securityAnswer) {
        return res.render("forgot-password", { 
          step: 1, 
          error: "No security question set for this account. Please contact support." 
        });
      }

      return res.render("forgot-password", { 
        step: 2, 
        email: email,
        securityQuestion: user.securityQuestion,
        error: null 
      });
    }

    // Step 2: Verify security answer and reset password
    if (email && securityAnswer && newPassword) {
      const user = await usersCollection.findOne({ email: email });

      if (!user) {
        return res.render("forgot-password", { 
          step: 1, 
          error: "Email address not found." 
        });
      }

      // Verify security answer (case-insensitive)
      if (user.securityAnswer.toLowerCase() !== securityAnswer.toLowerCase()) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: "Incorrect answer to security question." 
        });
      }

      // Validate new password
      if (newPassword !== confirmPassword) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: "Passwords do not match." 
        });
      }

      // Validate password requirements
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: passwordValidation.message 
        });
      }

      // Check password history - prevent reusing last 5 passwords
      const passwordHistory = user.passwordHistory || [];
      
      // Check current password
      const isCurrentPassword = await bcrypt.compare(newPassword, user.password);
      if (isCurrentPassword) {
        return res.render("forgot-password", { 
          step: 2,
          email: email,
          securityQuestion: user.securityQuestion,
          error: "Cannot reuse your current password. Please choose a different password." 
        });
      }

      // Check against password history (last 5 passwords)
      for (let oldHash of passwordHistory) {
        const isOldPassword = await bcrypt.compare(newPassword, oldHash);
        if (isOldPassword) {
          return res.render("forgot-password", { 
            step: 2,
            email: email,
            securityQuestion: user.securityQuestion,
            error: "Cannot reuse any of your last 5 passwords. Please choose a different password." 
          });
        }
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      await usersCollection.updateOne(
        { email: email },
        { 
          $set: { 
            password: hashedPassword,
            failedLoginAttempts: 0
          },
          $unset: { lockUntil: "" }
        }
      );

      return res.render("forgot-password", { 
        step: 3,
        success: true,
        error: null 
      });
    }

  } catch (error) {
    console.error("Error during password reset:", error);
    return res.render("forgot-password", { 
      step: 1, 
      error: "Internal server error." 
    });
  }
});

// Password validation function
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) {
    return { 
      isValid: false, 
      message: `Password must be at least ${minLength} characters long.` 
    };
  }

  if (!hasUpperCase) {
    return { 
      isValid: false, 
      message: "Password must contain at least one uppercase letter." 
    };
  }

  if (!hasNumber) {
    return { 
      isValid: false, 
      message: "Password must contain at least one number." 
    };
  }

  if (!hasSpecialChar) {
    return { 
      isValid: false, 
      message: "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)" 
    };
  }

  return { isValid: true, message: "Password is valid." };
}

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

    res.render("profile");

});

app.get('/create',(req, res) =>{
    res.render("create");
  }
);

// registers posts into the db
app.post('/create', async (req,res) => {
  
  try{

    let sessionUser = req.session.userInfo;

    const {subject,message,tag} = req.body;

    if (!subject || !message || !tag){
      return res.redirect('/create');
    }
    
    const date = new Date(Date.now()).toUTCString();

    const postsCollection = client.db("ForumsDB").collection("Posts");

    const result = await postsCollection.insertOne({
      author:sessionUser.username,
      authorPic:sessionUser.profilePic,
      subject:subject,
      message:message,
      tag:tag,
      date:date,
      dislikes: 0,
      likes: 0,
      authorID:sessionUser._id.toString(),
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
      return res.redirect('/index');
    } else {
      return res.status(404).json({ message: "Post not found or could not be deleted." });
    }
  } catch (error) {
    console.error("Error occurred during post deletion:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});


app.get('/signup', (req, res) =>{

  res.render("signup", { error: null });

});

// Handle registering users to the DB with enhanced validation
app.post('/signup', async (req, res) => {
  try {
      const { email, username, password, confirmpassword, securityQuestion, securityAnswer } = req.body;
      
      // Make sure all required fields are provided
      if (!email || !username || !password || !confirmpassword) {
          return res.render("signup", { 
            error: "All fields are required." 
          });
      }

      // Check if passwords match
      if (password !== confirmpassword) {
          return res.render("signup", { 
            error: "Passwords do not match." 
          });
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
          return res.render("signup", { 
            error: passwordValidation.message 
          });
      }

      const usersCollection = client.db("ForumsDB").collection("Users");

      // Check if username already exists (case-insensitive)
      const existingUsername = await usersCollection.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      
      if (existingUsername) {
          return res.render("signup", { 
            error: "Username already exists. Please choose a different username." 
          });
      }

      // Check if email already exists
      const existingEmail = await usersCollection.findOne({ email: email });
      
      if (existingEmail) {
          return res.render("signup", { 
            error: "Email address already registered. Please use a different email." 
          });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert the user data into the database
      const result = await usersCollection.insertOne({
          email: email,
          username: username,
          password: hashedPassword,
          profilePic: "https://news.tulane.edu/sites/default/files/headshot_icon_0.jpg",
          description: "",
          dlsuID: "",
          dlsuRole:  "member",
          gender: "",
          securityQuestion: securityQuestion || "What is your favorite color?",
          securityAnswer: securityAnswer || "",
          failedLoginAttempts: 0,
          passwordHistory: []
      });

      // If insertion is successful, respond with a success message
      if (result.insertedId) {
          return res.redirect('/login');
      } else {
          return res.render("signup", { 
            error: "Failed to create account. Please try again." 
          });
      }
  } catch (error) {
      console.error("Error occurred during signup:", error);
      return res.render("signup", { 
        error: "Internal server error. Please try again later." 
      });
  }
});

app.get('/editPost', (req, res) =>{

  res.render("editPost");

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
      return res.redirect('/index');
    } else {
      return res.status(404).json({ message: "Post not found or could not be updated." });
    }
  } catch (error) {
    console.error("Error occurred during post editing:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});


app.get('/editProfile', (req, res) =>{
  
  res.render("editProfile");

});

app.get('/viewpost', (req, res) =>{

  res.render("viewpost");

});

app.post('/viewpost', (req, res) =>{

  res.render("viewpost");

});

app.get('/userPosts', (req, res) =>{

  res.render("userPosts");

});

app.get('/userList', (req, res) =>{

  res.render("userList");

});

app.get("/userListData", async (req, res) => {
  const usersCollection = client.db("ForumsDB").collection("Users");

  const cursor = usersCollection.find();

  // Print a message if no documents were found
  if ((await usersCollection.countDocuments()) === 0) {
    console.log("No documents found!");
  }

  const array =  await cursor.toArray();
  res.json(array);
});
